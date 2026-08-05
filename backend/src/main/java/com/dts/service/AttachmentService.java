package com.dts.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.dts.common.BusinessException;
import com.dts.domain.Comment;
import com.dts.domain.Issue;
import com.dts.domain.IssueAttachment;
import com.dts.dto.FeatureDtos;
import com.dts.mapper.CommentMapper;
import com.dts.mapper.IssueAttachmentMapper;
import com.dts.mapper.IssueMapper;
import com.dts.security.LoginUser;
import com.dts.security.SecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AttachmentService {

    private static final long MAX_SIZE = 50L * 1024 * 1024;
    private static final List<String> SOURCE_TYPES = List.of("ISSUE", "COMMENT");

    private final IssueAttachmentMapper attachmentMapper;
    private final IssueMapper issueMapper;
    private final CommentMapper commentMapper;
    private final IssuePermissionService permissionService;
    private final LookupService lookupService;

    @Value("${app.storage.root:./uploads}")
    private String storageRoot;

    @Transactional
    public FeatureDtos.AttachmentVo upload(Long issueId, String sourceType, Long sourceId, MultipartFile file) {
        Issue issue = requireIssue(issueId);
        permissionService.requireParticipantOrLeader(issue);
        if (file == null || file.isEmpty()) throw new BusinessException("请选择要上传的文件");
        if (file.getSize() > MAX_SIZE) throw new BusinessException("单个附件不能超过 50MB");
        String normalizedType = sourceType == null ? "ISSUE" : sourceType.toUpperCase(Locale.ROOT);
        if (!SOURCE_TYPES.contains(normalizedType)) throw new BusinessException("非法附件来源类型");
        if ("COMMENT".equals(normalizedType)) {
            Comment comment = sourceId == null ? null : commentMapper.selectById(sourceId);
            if (comment == null || !issueId.equals(comment.getIssueId())) {
                throw new BusinessException("评论不存在或不属于当前问题");
            }
        }

        String originalName = safeOriginalName(file.getOriginalFilename());
        String suffix = "";
        int dot = originalName.lastIndexOf('.');
        if (dot > -1 && originalName.length() - dot <= 16) suffix = originalName.substring(dot);
        String storedName = UUID.randomUUID().toString().replace("-", "") + suffix;
        Path root = Path.of(storageRoot).toAbsolutePath().normalize();
        Path issueDir = root.resolve(String.valueOf(issueId)).normalize();
        Path target = issueDir.resolve(storedName).normalize();
        if (!target.startsWith(issueDir)) throw new BusinessException("非法文件路径");
        try {
            Files.createDirectories(issueDir);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new BusinessException("附件保存失败");
        }

        IssueAttachment attachment = IssueAttachment.builder()
                .issueId(issueId)
                .uploaderId(SecurityUtil.currentUserId())
                .sourceType(normalizedType)
                .sourceId(sourceId)
                .originalName(originalName)
                .storedName(storedName)
                .contentType(file.getContentType())
                .fileSize(file.getSize())
                .storagePath(target.toString())
                .build();
        try {
            attachmentMapper.insert(attachment);
        } catch (RuntimeException e) {
            try {
                Files.deleteIfExists(target);
            } catch (IOException ignored) {
                // 数据库异常优先返回，临时文件由运维清理。
            }
            throw e;
        }
        return toVo(attachment);
    }

    public List<FeatureDtos.AttachmentVo> list(Long issueId) {
        requireIssue(issueId);
        return attachmentMapper.selectList(Wrappers.<IssueAttachment>lambdaQuery()
                        .eq(IssueAttachment::getIssueId, issueId)
                        .orderByDesc(IssueAttachment::getCreatedAt))
                .stream().map(this::toVo).toList();
    }

    public IssueAttachment require(Long id) {
        IssueAttachment attachment = attachmentMapper.selectById(id);
        if (attachment == null) throw new BusinessException("附件不存在: " + id);
        requireIssue(attachment.getIssueId());
        return attachment;
    }

    public FileSystemResource resource(IssueAttachment attachment) {
        Path path = Path.of(attachment.getStoragePath()).toAbsolutePath().normalize();
        FileSystemResource resource = new FileSystemResource(path);
        if (!resource.exists() || !resource.isReadable()) throw new BusinessException("附件文件不存在");
        return resource;
    }

    @Transactional
    public void delete(Long id) {
        IssueAttachment attachment = require(id);
        LoginUser user = SecurityUtil.current();
        if (!user.getId().equals(attachment.getUploaderId())) {
            throw new BusinessException(403, "仅上传者本人可删除附件");
        }
        attachmentMapper.deleteById(id);
        try {
            Files.deleteIfExists(Path.of(attachment.getStoragePath()));
        } catch (IOException e) {
            throw new BusinessException("附件记录已删除，但文件清理失败");
        }
    }

    private Issue requireIssue(Long issueId) {
        Issue issue = issueMapper.selectById(issueId);
        if (issue == null) throw new BusinessException("问题不存在: " + issueId);
        return issue;
    }

    private FeatureDtos.AttachmentVo toVo(IssueAttachment attachment) {
        FeatureDtos.AttachmentVo vo = new FeatureDtos.AttachmentVo();
        vo.setId(attachment.getId());
        vo.setIssueId(attachment.getIssueId());
        vo.setUploaderId(attachment.getUploaderId());
        vo.setUploaderName(lookupService.userName(attachment.getUploaderId()));
        vo.setSourceType(attachment.getSourceType());
        vo.setSourceId(attachment.getSourceId());
        vo.setOriginalName(attachment.getOriginalName());
        vo.setContentType(attachment.getContentType());
        vo.setFileSize(attachment.getFileSize());
        vo.setCreatedAt(attachment.getCreatedAt());
        return vo;
    }

    private String safeOriginalName(String name) {
        if (name == null || name.isBlank()) return "attachment";
        String normalized = name.replace('\\', '/');
        String base = normalized.substring(normalized.lastIndexOf('/') + 1)
                .replaceAll("[\\r\\n\\t]", "_");
        return base.length() > 255 ? base.substring(base.length() - 255) : base;
    }
}
