import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export function UserAvatar({
  name,
  color,
  className,
}: {
  name?: string
  color?: string
  className?: string
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase()
  return (
    <Avatar className={cn("size-7", className)}>
      <AvatarFallback style={{ backgroundColor: color || "#6366f1" }}>{initial}</AvatarFallback>
    </Avatar>
  )
}
