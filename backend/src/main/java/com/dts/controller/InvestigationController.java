package com.dts.controller;

import com.dts.common.ApiResponse;
import com.dts.domain.VersionInvestigation;
import com.dts.dto.InvestigationDtos;
import com.dts.service.InvestigationService;
import com.dts.service.FeatureGuard;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/investigations")
@RequiredArgsConstructor
public class InvestigationController {

    private final InvestigationService investigationService;
    private final FeatureGuard featureGuard;

    @GetMapping
    public ApiResponse<List<VersionInvestigation>> listByIssue(@RequestParam(required = false) Long issueId,
                                                               @RequestParam(required = false) Long versionId) {
        featureGuard.requireEnabled("investigations", "版本排查");
        if (versionId != null) {
            return ApiResponse.ok(investigationService.listByVersion(versionId));
        }
        if (issueId != null) {
            return ApiResponse.ok(investigationService.listByIssue(issueId));
        }
        return ApiResponse.ok(List.of());
    }

    @PostMapping
    public ApiResponse<VersionInvestigation> create(@Valid @RequestBody InvestigationDtos.InvestigationSaveRequest req) {
        featureGuard.requireEnabled("investigations", "版本排查");
        return ApiResponse.ok(investigationService.create(req));
    }

    @PutMapping("/{id}")
    public ApiResponse<VersionInvestigation> update(@PathVariable Long id,
                                                    @Valid @RequestBody InvestigationDtos.InvestigationSaveRequest req) {
        featureGuard.requireEnabled("investigations", "版本排查");
        return ApiResponse.ok(investigationService.update(id, req));
    }

    @PostMapping("/generate")
    public ApiResponse<InvestigationDtos.GenerateResult> generate(@Valid @RequestBody InvestigationDtos.GenerateInvestigationRequest req) {
        featureGuard.requireEnabled("investigations", "版本排查");
        return ApiResponse.ok(investigationService.generateForVersion(req));
    }
}
