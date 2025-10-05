"use client";

import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Kbd } from "@/components/ui/kbd";

type DashboardStep =
  | "upload"
  | "analyze"
  | "generate-tests"
  | "run-tests"
  | "chat";

interface DashboardSidebarProps {
  currentStep: DashboardStep;
  onStepChange: (step: DashboardStep) => void;
  isAnalyzing?: boolean;
  isGeneratingTests?: boolean;
  isRunningTests?: boolean;
  isChatting?: boolean;
}

export function DashboardSidebar({
  currentStep,
  onStepChange,
  isAnalyzing = false,
  isGeneratingTests = false,
  isRunningTests = false,
  isChatting = false,
}: DashboardSidebarProps) {
  const menuItems = [
    {
      step: "upload" as const,

      label: "Upload Files",
      description: "Upload code files or select from GitHub",
    },
    {
      step: "analyze" as const,

      label: "Analyze Code",
      description: "Review and analyze your code",
      disabled: false,
      loading: isAnalyzing,
    },
    {
      step: "generate-tests" as const,

      label: "Generate Tests",
      description: "Generate unit tests for your code",
      disabled: false,
      loading: isGeneratingTests,
    },
    {
      step: "chat" as const,
      label: "Chat",
      description: "Chat with your code / codebase",
      disabled: false,
      loading: isChatting,
    },
    // },
    // {
    //   step: "run-tests" as const,
    //   icon: Play,
    //   label: "Run Tests",
    //   description: "Execute tests in sandbox environment",
    //   disabled: false,
    //   loading: isRunningTests,
    // },
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2">
          {/* <FileText className="h-6 w-6 text-blue-600" /> */}
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold">CodeMarshall</h2>
            <p className="text-xs text-muted-foreground">
              Code Analysis & Testing
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workflow</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                // const Icon = item.icon;
                const isActive = currentStep === item.step;
                const isLoading = item.loading;

                return (
                  <SidebarMenuItem key={item.step}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => onStepChange(item.step)}
                      disabled={item.disabled}
                      className="flex flex-col hover:cursor-pointer items-start gap-1 h-auto py-3"
                    >
                      <div className="flex items-center gap-2 w-full">
                        {/* <Icon className="h-4 w-4" /> */}
                        <span className="flex-1">{item.label}</span>
                        {isLoading && (
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground text-left">
                        {item.description}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Press <Kbd>⌘</Kbd> + <Kbd>B</Kbd> to toggle
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
