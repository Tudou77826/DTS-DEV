import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { UserAvatar } from "@/components/user-avatar"

describe("UserAvatar", () => {
  it("取姓名首字母作为头像文字", () => {
    render(<UserAvatar name="王五" color="#10b981" />)
    expect(screen.getByText("王")).toBeInTheDocument()
  })

  it("空姓名回退为 ?", () => {
    render(<UserAvatar />)
    expect(screen.getByText("?")).toBeInTheDocument()
  })

  it("英文名取大写首字母", () => {
    render(<UserAvatar name="leader" />)
    expect(screen.getByText("L")).toBeInTheDocument()
  })
})
