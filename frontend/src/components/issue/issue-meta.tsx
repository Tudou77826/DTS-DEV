import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { Issue } from "@/lib/types"

export function IssueMeta({ issue }: { issue: Issue }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5 text-sm">
        <Section title="问题描述">
          <p className="whitespace-pre-wrap">{issue.description}</p>
        </Section>
        {issue.searchKeywords && (
          <Section title="查询关键字">
            <p className="whitespace-pre-wrap font-mono text-xs">{issue.searchKeywords}</p>
          </Section>
        )}
        {issue.latestProgress && (
          <Section title="当前进展">
            <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">{issue.latestProgress}</p>
          </Section>
        )}
        <Separator />
        <div className="grid grid-cols-2 gap-4">
          {issue.envInfo && <Section title="环境信息"><p className="whitespace-pre-wrap text-xs">{issue.envInfo}</p></Section>}
          {issue.vpnInfo && <Section title="VPN 信息"><p className="text-xs">{issue.vpnInfo}</p></Section>}
        </div>
      </CardContent>
    </Card>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">{title}</h4>
      {children}
    </div>
  )
}
