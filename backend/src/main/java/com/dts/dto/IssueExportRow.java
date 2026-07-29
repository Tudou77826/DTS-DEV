package com.dts.dto;

import com.alibaba.excel.annotation.ExcelProperty;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class IssueExportRow {

    @ExcelProperty("问题编号")
    private String code;
    @ExcelProperty("问题标题")
    private String title;
    @ExcelProperty("问题描述")
    private String description;
    @ExcelProperty("产品")
    private String product;
    @ExcelProperty("模块")
    private String module;
    @ExcelProperty("发现版本")
    private String foundVersion;
    @ExcelProperty("状态")
    private String status;
    @ExcelProperty("优先级")
    private String priority;
    @ExcelProperty("提出人")
    private String submitter;
    @ExcelProperty("责任人")
    private String assignee;
    @ExcelProperty("创建时间")
    private LocalDateTime createdAt;
    @ExcelProperty("计划完成时间")
    private LocalDateTime planFinishAt;
    @ExcelProperty("解决时间")
    private LocalDateTime resolvedAt;
    @ExcelProperty("关闭时间")
    private LocalDateTime closedAt;
}
