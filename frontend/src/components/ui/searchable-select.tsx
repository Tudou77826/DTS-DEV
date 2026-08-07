import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover"

/**
 * 带搜索过滤的单选下拉（用于人员等选项较多的枚举）。
 * 不可自定义输入，仅从 options 中选择；选项过多时通过搜索框快速过滤。
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyText = "无匹配项",
  searchPlaceholder = "搜索…",
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
  emptyText?: string
  searchPlaceholder?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const selected = options.find((option) => option.value === value)
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()))

  const select = (optionValue: string) => {
    onChange(optionValue)
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-[3px] focus:ring-ring/50 focus:border-ring",
            "disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
            className
          )}
        >
          <span className={cn(!selected && "text-muted-foreground")}>{selected?.label || placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-full min-w-[var(--radix-popover-trigger-width)] p-0"
      >
        <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
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
                onMouseDown={(e) => { e.preventDefault(); select(option.value) }}
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
        </div>
      </PopoverContent>
    </Popover>
  )
}
