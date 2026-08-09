import { describe, expect, it } from "vitest"
import {
  STATUS_META, PRIORITY_META, ROLE_LABEL,
  applyCustomizationLabels,
  statusLabel, priorityLabel,
  formatDateTime, formatDuration, formatFileSize,
} from "@/lib/labels"
import type { DtsCustomization } from "@/lib/types"

describe("状态与优先级标签", () => {
  it("内置五种状态的标签", () => {
    expect(statusLabel("PENDING_ASSIGN")).toBe("待分配")
    expect(statusLabel("PENDING_HANDLE")).toBe("待处理")
    expect(statusLabel("PROCESSING")).toBe("处理中")
    expect(statusLabel("RESOLVED")).toBe("已解决")
    expect(statusLabel("CLOSED")).toBe("已关闭")
  })

  it("未知状态原样返回", () => {
    expect(statusLabel("UNKNOWN_STATUS")).toBe("UNKNOWN_STATUS")
  })

  it("优先级标签", () => {
    expect(priorityLabel("URGENT")).toBe("紧急")
    expect(priorityLabel("NOPE")).toBe("NOPE")
  })
})

describe("定制化标签覆盖", () => {
  it("applyCustomizationLabels 用配置覆盖默认标签", () => {
    const config = {
      issue: {
        statuses: [
          { value: "PROCESSING", label: "正在处理", color: "#000000" },
        ],
        priorities: [
          { value: "HIGH", label: "高优先级", color: "#ff0000" },
        ],
      },
      roles: [
        { value: "DEVELOPER", label: "研发工程师", color: "#000000" },
      ],
    } as unknown as DtsCustomization

    applyCustomizationLabels(config)

    expect(STATUS_META.PROCESSING.label).toBe("正在处理")
    expect(PRIORITY_META.HIGH.label).toBe("高优先级")
    expect(ROLE_LABEL.DEVELOPER).toBe("研发工程师")
    // 未覆盖的状态保持默认
    expect(STATUS_META.CLOSED.label).toBe("已关闭")
  })
})

describe("时间与体积格式化", () => {
  it("formatDateTime 空值返回 -", () => {
    expect(formatDateTime()).toBe("-")
  })

  it("formatDuration 各档位", () => {
    expect(formatDuration()).toBe("-")
    expect(formatDuration(45)).toBe("45 分钟")
    expect(formatDuration(90)).toBe("1 小时 30 分")
    expect(formatDuration(120)).toBe("2 小时")
  })

  it("formatFileSize 各档位", () => {
    expect(formatFileSize()).toBe("-")
    expect(formatFileSize(512)).toBe("512 B")
    expect(formatFileSize(2048)).toBe("2.0 KB")
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB")
  })
})
