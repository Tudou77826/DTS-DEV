package com.dts.controller;

import com.dts.common.ApiResponse;
import com.dts.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.ok(statsService.overview());
    }

    @GetMapping("/version-remain")
    public ApiResponse<Map<Long, Long>> versionRemain() {
        return ApiResponse.ok(statsService.versionRemainCount());
    }
}
