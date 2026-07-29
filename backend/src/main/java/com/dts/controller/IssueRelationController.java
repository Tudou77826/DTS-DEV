package com.dts.controller;

import com.dts.common.ApiResponse;
import com.dts.dto.FeatureDtos;
import com.dts.service.IssueRelationService;
import com.dts.service.FeatureGuard;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/issues/{issueId}/relations")
@RequiredArgsConstructor
public class IssueRelationController {

    private final IssueRelationService relationService;
    private final FeatureGuard featureGuard;

    @GetMapping
    public ApiResponse<List<FeatureDtos.RelationVo>> list(@PathVariable Long issueId) {
        featureGuard.requireEnabled("relations", "问题关联");
        return ApiResponse.ok(relationService.list(issueId));
    }

    @PostMapping
    public ApiResponse<FeatureDtos.RelationVo> create(
            @PathVariable Long issueId,
            @Valid @RequestBody FeatureDtos.RelationRequest request) {
        featureGuard.requireEnabled("relations", "问题关联");
        return ApiResponse.ok(relationService.create(issueId, request));
    }

    @DeleteMapping("/{relationId}")
    public ApiResponse<Void> delete(@PathVariable Long issueId, @PathVariable Long relationId) {
        featureGuard.requireEnabled("relations", "问题关联");
        relationService.delete(issueId, relationId);
        return ApiResponse.ok();
    }
}
