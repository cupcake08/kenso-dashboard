"use client";

import { useMemo, useState } from "react";

import { CodeExample } from "@/components/docs/code-example";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface CodeTabItem {
  id: string;
  label: string;
  language: string;
  code: string;
  title?: string;
  note?: string;
}

interface CodeTabsProps {
  title: string;
  description?: string;
  tabs: CodeTabItem[];
  defaultTab?: string;
  className?: string;
  maxHeight?: string;
  showLineNumbers?: boolean;
}

export function CodeTabs({
  title,
  description,
  tabs,
  defaultTab,
  className,
  maxHeight,
  showLineNumbers = false,
}: CodeTabsProps) {
  const initialTab = defaultTab ?? tabs[0]?.id ?? "";
  const [activeTab, setActiveTab] = useState(initialTab);

  const current = useMemo(() => {
    return tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  }, [activeTab, tabs]);

  if (!current) {
    return null;
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className={cn("rounded-[1.25rem] border border-border/70 bg-background/45", className)}>
      <div className="border-b border-border/60 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">{title}</p>
            {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
            {current.note ? (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {current.note}
              </p>
            ) : null}
          </div>

          <TabsList className="self-start">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>

      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="p-3 sm:p-3.5">
          <CodeExample
            title={tab.title ?? tab.label}
            language={tab.language}
            code={tab.code}
            maxHeight={maxHeight}
            showLineNumbers={showLineNumbers}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
