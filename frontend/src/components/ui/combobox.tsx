import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover"

/**
 * 下拉 + 可输入自定义的选择框。
 * 枚举选项来自接入配置，但不限制输入：可直接选择，也可输入任意新值。
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  emptyText = "无匹配项",
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
  emptyText?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()))

  const select = (label: string) => {
    onChange(label)
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative", className)}>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="pr-9"
          />
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v) }}
            className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground hover:text-foreground"
            aria-label="展开选项"
          >
            <ChevronsUpDown className="size-4" />
          </button>
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-full min-w-[var(--radix-popover-trigger-width)] p-0"
      >
        <div className="border-b border-border px-2 py-1.5">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索…"
            className="h-8 border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(option.label) }}
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  option.value === value && "bg-accent/60"
                )}
              >
                <span className="truncate">{option.label}</span>
                {option.value === value && <Check className="size-4 shrink-0" />}
              </button>
            ))
          )}
          {query.trim() && (
            <div className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
              当前输入将作为自定义值保存
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
