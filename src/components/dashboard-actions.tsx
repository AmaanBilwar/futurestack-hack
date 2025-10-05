"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Search,
  Code,
  Play,
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Wand2,
} from "lucide-react";

type DashboardStep =
  | "upload"
  | "analyze"
  | "generate-tests"
  | "run-tests"
  | "chat";

interface DashboardActionsProps {
  currentStep: DashboardStep;
  onAnalyzeCode: () => void;
  onGenerateTests: () => void;
  onRunTests: () => void;
  onUploadFiles: () => void;
  onApplyRefactor?: () => void;
  isAnalyzing: boolean;
  isGeneratingTests: boolean;
  isRunningTests: boolean;
  isApplyingRefactor?: boolean;
  canAnalyze: boolean;
  canGenerateTests: boolean;
  canRunTests: boolean;
  canApplyRefactor?: boolean;
  analysisResultsCount: number;
  unitTestResultsCount: number;
  onChat: () => void;
  canChat: boolean;
  isChatting: boolean;
}

export function DashboardActions({
  currentStep,
  onAnalyzeCode,
  onGenerateTests,
  onRunTests,
  onUploadFiles,
  onApplyRefactor,
  isAnalyzing,
  isGeneratingTests,
  isRunningTests,
  isApplyingRefactor = false,
  canAnalyze,
  canGenerateTests,
  canRunTests,
  canApplyRefactor = false,
  analysisResultsCount,
  unitTestResultsCount,
  onChat,
  canChat,
  isChatting,
}: DashboardActionsProps) {
  const actions = [
    {
      id: "analyze",
      title: "Analyze Code",
      description: "Review your code for improvements and issues",
      action: onAnalyzeCode,
      disabled: !canAnalyze || isAnalyzing,
      loading: isAnalyzing,
      badge:
        analysisResultsCount > 0
          ? `${analysisResultsCount} analyzed`
          : undefined,
      variant: "default" as const,
    },
    {
      id: "generate-tests",
      title: "Generate Unit Tests",
      description: "Create comprehensive unit tests for your code",
      action: onGenerateTests,
      disabled: !canGenerateTests || isGeneratingTests,
      loading: isGeneratingTests,
      badge:
        unitTestResultsCount > 0
          ? `${unitTestResultsCount} generated`
          : undefined,
      variant: "default" as const,
    },
    {
      id: "chat",
      title: "Chat",
      description: "Chat with your code / codebase",
      action: onChat,
      disabled: !canChat || isChatting,
      loading: isChatting,
      variant: "default" as const,
    },
    // {
    //   id: "run-tests",
    //   title: "Run Tests",
    //   description: "Execute tests in secure sandbox environment",
    //   icon: Play,
    //   action: onRunTests,
    //   disabled: !canRunTests || isRunningTests,
    //   loading: isRunningTests,
    //   variant: "default" as const,
    // },
  ];

  const getStatusInfo = () => {
    switch (currentStep) {
      case "upload":
        return {
          icon: Upload,
          title: "Ready to Upload",
          description: "Upload your files or select from GitHub to get started",
          color: "text-blue-600",
        };
      case "analyze":
        return {
          icon: isAnalyzing
            ? Spinner
            : analysisResultsCount > 0
              ? CheckCircle
              : Search,
          title: isAnalyzing
            ? "Analyzing..."
            : analysisResultsCount > 0
              ? "Analysis Complete"
              : "Ready to Analyze",
          description: isAnalyzing
            ? "Reviewing your code..."
            : analysisResultsCount > 0
              ? `${analysisResultsCount} files analyzed`
              : "Select files to analyze",
          color: isAnalyzing
            ? "text-blue-600"
            : analysisResultsCount > 0
              ? "text-green-600"
              : "text-gray-600",
        };
      case "generate-tests":
        return {
          icon: isGeneratingTests
            ? Spinner
            : unitTestResultsCount > 0
              ? CheckCircle
              : Code,
          title: isGeneratingTests
            ? "Generating..."
            : unitTestResultsCount > 0
              ? "Tests Generated"
              : "Ready to Generate",
          description: isGeneratingTests
            ? "Creating unit tests..."
            : unitTestResultsCount > 0
              ? `${unitTestResultsCount} test files generated`
              : "Analyze code first",
          color: isGeneratingTests
            ? "text-blue-600"
            : unitTestResultsCount > 0
              ? "text-green-600"
              : "text-gray-600",
        };
      case "run-tests":
        return {
          icon: isRunningTests ? Spinner : Play,
          title: isRunningTests ? "Running Tests..." : "Ready to Run",
          description: isRunningTests
            ? "Executing in sandbox..."
            : "Generate tests first",
          color: isRunningTests ? "text-blue-600" : "text-gray-600",
        };
      default:
        return {
          icon: FileText,
          title: "Dashboard",
          description: "Manage your code analysis workflow",
          color: "text-gray-600",
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="w-full space-y-4">
      {/* Status Card */}
      <Card className="border-2">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
            {statusInfo.title}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {statusInfo.description}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Action Buttons */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Actions</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Available actions for the current step
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {actions.map((action) => {
            const isHighlighted = "highlight" in action && action.highlight;
            return (
              <Button
                key={action.id}
                onClick={action.action}
                disabled={action.disabled}
                variant={action.variant}
                className={`w-full hover:cursor-pointer justify-start gap-3 h-auto py-4 px-4 text-left hover:bg-opacity-90 transition-all duration-200 ${
                  isHighlighted ? "ring-2 ring-blue-500 ring-offset-2" : ""
                } ${action.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-start gap-3 w-full min-w-0">
                  <div className="flex-shrink-0 mt-0.5">
                    {action.loading ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <span className="text-sm font-medium text-left">
                      {action.title}
                    </span>
                    <span className="text-xs opacity-80 text-left leading-relaxed break-words">
                      {action.description}
                    </span>
                  </div>
                  {action.badge && (
                    <Badge
                      variant="secondary"
                      className="text-xs flex-shrink-0"
                    >
                      {action.badge}
                    </Badge>
                  )}
                </div>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      {(analysisResultsCount > 0 || unitTestResultsCount > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analysisResultsCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-green-600" />
                  Files Analyzed
                </span>
                <Badge variant="outline">{analysisResultsCount}</Badge>
              </div>
            )}
            {unitTestResultsCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-blue-600" />
                  Tests Generated
                </span>
                <Badge variant="outline">{unitTestResultsCount}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
