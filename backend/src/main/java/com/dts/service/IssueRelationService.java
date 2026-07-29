package com.dts.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.dts.common.BusinessException;
import com.dts.domain.Issue;
import com.dts.domain.IssueRelation;
import com.dts.dto.FeatureDtos;
import com.dts.mapper.IssueMapper;
import com.dts.mapper.IssueRelationMapper;
import com.dts.security.SecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class IssueRelationService {

    private static final Set<String> TYPES = Set.of("RELATED", "DUPLICATE");

    private final IssueRelationMapper relationMapper;
    private final IssueMapper issueMapper;
    private final IssuePermissionService permissionService;

    @Transactional
    public FeatureDtos.RelationVo create(Long issueId, FeatureDtos.RelationRequest request) {
        Issue issue = requireIssue(issueId);
        permissionService.requireParticipantOrLeader(issue);
        if (issueId.equals(request.getTargetIssueId())) throw new BusinessException("问题不能关联自身");
        Issue target = requireIssue(request.getTargetIssueId());
        String type = request.getRelationType().toUpperCase();
        if (!TYPES.contains(type)) throw new BusinessException("关联类型仅支持 RELATED 或 DUPLICATE");
        long sourceId = Math.min(issueId, target.getId());
        long targetId = Math.max(issueId, target.getId());
        if (relationMapper.selectCount(Wrappers.<IssueRelation>lambdaQuery()
                .eq(IssueRelation::getSourceIssueId, sourceId)
                .eq(IssueRelation::getTargetIssueId, targetId)
                .eq(IssueRelation::getRelationType, type)) > 0) {
            throw new BusinessException("该问题关联已存在");
        }
        IssueRelation relation = IssueRelation.builder()
                .sourceIssueId(sourceId)
                .targetIssueId(targetId)
                .relationType(type)
                .createdBy(SecurityUtil.currentUserId())
                .build();
        relationMapper.insert(relation);
        return toVo(relation, issueId);
    }

    public List<FeatureDtos.RelationVo> list(Long issueId) {
        requireIssue(issueId);
        return relationMapper.selectList(Wrappers.<IssueRelation>lambdaQuery()
                        .and(w -> w.eq(IssueRelation::getSourceIssueId, issueId)
                                .or().eq(IssueRelation::getTargetIssueId, issueId))
                        .orderByDesc(IssueRelation::getCreatedAt))
                .stream().map(r -> toVo(r, issueId)).toList();
    }

    @Transactional
    public void delete(Long issueId, Long relationId) {
        Issue issue = requireIssue(issueId);
        permissionService.requireParticipantOrLeader(issue);
        IssueRelation relation = relationMapper.selectById(relationId);
        if (relation == null || (!issueId.equals(relation.getSourceIssueId())
                && !issueId.equals(relation.getTargetIssueId()))) {
            throw new BusinessException("问题关联不存在");
        }
        relationMapper.deleteById(relationId);
    }

    private FeatureDtos.RelationVo toVo(IssueRelation relation, Long currentIssueId) {
        Long otherId = currentIssueId.equals(relation.getSourceIssueId())
                ? relation.getTargetIssueId() : relation.getSourceIssueId();
        Issue other = requireIssue(otherId);
        FeatureDtos.RelationVo vo = new FeatureDtos.RelationVo();
        vo.setId(relation.getId());
        vo.setIssueId(otherId);
        vo.setIssueCode(other.getCode());
        vo.setTitle(other.getTitle());
        vo.setDescription(other.getDescription());
        vo.setRelationType(relation.getRelationType());
        vo.setCreatedBy(relation.getCreatedBy());
        vo.setCreatedAt(relation.getCreatedAt());
        return vo;
    }

    private Issue requireIssue(Long id) {
        Issue issue = issueMapper.selectById(id);
        if (issue == null) throw new BusinessException("问题不存在: " + id);
        return issue;
    }
}
