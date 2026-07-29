package com.dts.controller;

import com.dts.common.ApiResponse;
import com.dts.domain.IssueAttachment;
import com.dts.dto.FeatureDtos;
import com.dts.service.AttachmentService;
import com.dts.service.FeatureGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping
@RequiredArgsConstructor
public class AttachmentController {

    private final AttachmentService attachmentService;
    private final FeatureGuard featureGuard;

    @GetMapping("/issues/{issueId}/attachments")
    public ApiResponse<List<FeatureDtos.AttachmentVo>> list(@PathVariable Long issueId) {
        featureGuard.requireEnabled("attachments", "附件");
        return ApiResponse.ok(attachmentService.list(issueId));
    }

    @PostMapping(value = "/issues/{issueId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<FeatureDtos.AttachmentVo> upload(
            @PathVariable Long issueId,
            @RequestParam(defaultValue = "ISSUE") String sourceType,
            @RequestParam(required = false) Long sourceId,
            @RequestParam("file") MultipartFile file) {
        featureGuard.requireEnabled("attachments", "附件");
        return ApiResponse.ok(attachmentService.upload(issueId, sourceType, sourceId, file));
    }

    @GetMapping("/attachments/{id}/download")
    public ResponseEntity<FileSystemResource> download(@PathVariable Long id) {
        featureGuard.requireEnabled("attachments", "附件");
        IssueAttachment attachment = attachmentService.require(id);
        FileSystemResource resource = attachmentService.resource(attachment);
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(attachment.getContentType());
        } catch (Exception ignored) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(attachment.getOriginalName(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(mediaType)
                .contentLength(attachment.getFileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(resource);
    }

    @DeleteMapping("/attachments/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        featureGuard.requireEnabled("attachments", "附件");
        attachmentService.delete(id);
        return ApiResponse.ok();
    }
}
