"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import Chat from "@/components/chat";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getGithubRepositories, listUserRepos } from "../github-functions";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Upload, File, X, FileText, Code, History, Folder } from "lucide-react";
import FileHistory from "@/components/file-history";
import SessionHistory from "@/components/session-history";

type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private?: boolean;
};

type UploadedFile = {
  id: string;
  name: string;
  content: string;
  type: string;
  size: number;
  analysis?: string;
};

type AnalysisResult = {
  fileId: string;
  fileName: string;
  analysis: string;
  status: "pending" | "completed" | "error";
};

type UnitTestResult = {
  fileId: string;
  fileName: string;
  unitTests: string;
  status: "pending" | "completed" | "error";
};

export default function DashboardPage() {
  const githubToken = useQuery(api.github.getGithubToken);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeTab, setActiveTab] = useState<"upload" | "files" | "sessions">(
    "upload"
  );
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [fetchingSelection, setFetchingSelection] = useState<boolean>(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadMode, setUploadMode] = useState<"github" | "upload">("github");
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [unitTestResults, setUnitTestResults] = useState<UnitTestResult[]>([]);
  const [isGeneratingTests, setIsGeneratingTests] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canGoNext = useMemo(
    () =>
      uploadMode === "github"
        ? Boolean(selectedRepo)
        : uploadedFiles.length > 0,
    [selectedRepo, uploadMode, uploadedFiles]
  );

  const canGoToStep3 = useMemo(
    () =>
      analysisResults.length > 0 &&
      analysisResults.every((result) => result.status === "completed"),
    [analysisResults]
  );

  const performCodeAnalysis = async (file: UploadedFile) => {
    try {
      const response = await fetch("/api/code-reviewer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: file.content,
          fileName: file.name,
        }),
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const result = await response.json();

      // Save analysis to Convex storage
      try {
        await fetch("/api/analyses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileId: file.id,
            fileName: file.name,
            analysis: result.analysis || "Analysis completed successfully.",
            status: "completed",
            userId: undefined, // TODO: Get actual user ID from auth
          }),
        });
      } catch (storageError) {
        console.error("Error saving analysis to storage:", storageError);
      }

      return result.analysis || "Analysis completed successfully.";
    } catch (error) {
      console.error("Error analyzing code:", error);
      return (
        "Error performing code analysis: " +
        (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  const analyzeAllFiles = async (files: UploadedFile[]) => {
    setIsAnalyzing(true);
    const newAnalysisResults: AnalysisResult[] = [];

    // Initialize all files as pending
    files.forEach((file) => {
      newAnalysisResults.push({
        fileId: file.id,
        fileName: file.name,
        analysis: "",
        status: "pending",
      });
    });

    setAnalysisResults(newAnalysisResults);

    // Analyze each file
    for (const file of files) {
      try {
        const analysis = await performCodeAnalysis(file);

        setAnalysisResults((prev) =>
          prev.map((result) =>
            result.fileId === file.id
              ? { ...result, analysis, status: "completed" as const }
              : result
          )
        );

        // Update the uploaded file with analysis
        setUploadedFiles((prev) =>
          prev.map((f) => (f.id === file.id ? { ...f, analysis } : f))
        );
      } catch (error) {
        setAnalysisResults((prev) =>
          prev.map((result) =>
            result.fileId === file.id
              ? {
                  ...result,
                  status: "error" as const,
                  analysis: "Failed to analyze code",
                }
              : result
          )
        );
      }
    }

    setIsAnalyzing(false);
  };

  const generateUnitTestsForFile = async (
    file: UploadedFile,
    analysis: string
  ) => {
    try {
      const response = await fetch("/api/unit-tests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: file.content,
          analysis: analysis,
          fileName: file.name,
        }),
      });

      if (!response.ok) {
        throw new Error("Unit test generation failed");
      }

      const result = await response.json();
      return result.unitTests || "Unit tests generated successfully.";
    } catch (error) {
      console.error("Error generating unit tests:", error);
      return (
        "Error generating unit tests: " +
        (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  const generateUnitTestsForAllFiles = async () => {
    if (
      !analysisResults.length ||
      !analysisResults.every((result) => result.status === "completed")
    ) {
      return;
    }

    setIsGeneratingTests(true);
    const newUnitTestResults: UnitTestResult[] = [];

    // Initialize all files as pending
    analysisResults.forEach((analysisResult) => {
      newUnitTestResults.push({
        fileId: analysisResult.fileId,
        fileName: analysisResult.fileName,
        unitTests: "",
        status: "pending",
      });
    });

    setUnitTestResults(newUnitTestResults);

    // Generate unit tests for each file
    for (const analysisResult of analysisResults) {
      if (analysisResult.status !== "completed") continue;

      const file = uploadedFiles.find((f) => f.id === analysisResult.fileId);
      if (!file) continue;

      try {
        const unitTests = await generateUnitTestsForFile(
          file,
          analysisResult.analysis
        );

        setUnitTestResults((prev) =>
          prev.map((result) =>
            result.fileId === analysisResult.fileId
              ? { ...result, unitTests, status: "completed" as const }
              : result
          )
        );
      } catch (error) {
        setUnitTestResults((prev) =>
          prev.map((result) =>
            result.fileId === analysisResult.fileId
              ? {
                  ...result,
                  status: "error" as const,
                  unitTests: "Failed to generate unit tests",
                }
              : result
          )
        );
      }
    }

    setIsGeneratingTests(false);
  };

  useEffect(() => {
    let mounted = true;
    async function loadRepos() {
      try {
        setLoadingRepos(true);
        if (!githubToken) return; // still loading or unauthenticated
        const data = await listUserRepos(githubToken as string);
        if (!mounted) return;
        setRepos(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoadingRepos(false);
      }
    }
    loadRepos();
    return () => {
      mounted = false;
    };
  }, [githubToken]);

  async function handleSelectRepo(repo: GithubRepo) {
    setSelectedRepo(repo);
    try {
      setFetchingSelection(true);
      // Ensure we invoke the provided helper once a repo is chosen
      if (!githubToken) return;
      await getGithubRepositories(
        repo.owner.login,
        repo.name,
        githubToken as string
      );
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingSelection(false);
    }
  }

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];

    // Create a new session for this upload batch
    let sessionId: string | null = null;
    try {
      const sessionResponse = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Upload Session - ${new Date().toLocaleDateString()}`,
          description: `Batch upload of ${files.length} files`,
          userId: undefined, // TODO: Get actual user ID from auth
          metadata: {
            sourceType: "upload",
            fileCount: files.length,
          },
        }),
      });

      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        sessionId = sessionData.sessionId;
      }
    } catch (error) {
      console.error("Error creating session:", error);
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Only accept code files
      const codeExtensions = [
        ".js",
        ".ts",
        ".jsx",
        ".tsx",
        ".py",
        ".java",
        ".cpp",
        ".c",
        ".cs",
        ".php",
        ".rb",
        ".go",
        ".rs",
        ".swift",
        ".kt",
        ".scala",
        ".r",
        ".m",
        ".sh",
        ".bash",
        ".zsh",
        ".fish",
        ".ps1",
        ".bat",
        ".cmd",
        ".sql",
        ".html",
        ".css",
        ".scss",
        ".sass",
        ".less",
        ".vue",
        ".svelte",
        ".json",
        ".xml",
        ".yaml",
        ".yml",
        ".toml",
        ".ini",
        ".conf",
        ".config",
      ];
      const isCodeFile = codeExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );

      if (!isCodeFile) {
        alert(`File "${file.name}" is not a supported code file type.`);
        continue;
      }

      try {
        const content = await file.text();

        // Step 1: Generate upload URL
        const uploadUrlResponse = await fetch("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            type: file.type || "text/plain",
            size: file.size,
            userId: undefined, // TODO: Get actual user ID from auth
            sessionId,
          }),
        });

        if (!uploadUrlResponse.ok) {
          throw new Error("Failed to generate upload URL");
        }

        const { uploadUrl } = await uploadUrlResponse.json();

        // Step 2: Upload file to Convex storage
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "text/plain" },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file to storage");
        }

        const { storageId } = await uploadResponse.json();

        // Step 3: Save file metadata with storage ID
        const saveResponse = await fetch("/api/files", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            storageId,
            type: file.type || "text/plain",
            size: file.size,
            userId: undefined, // TODO: Get actual user ID from auth
            sessionId,
            content, // Include content for metadata calculation
          }),
        });

        if (saveResponse.ok) {
          const fileData = await saveResponse.json();
          newFiles.push({
            id: fileData.fileId,
            name: file.name,
            content,
            type: file.type || "text/plain",
            size: file.size,
          });
        } else {
          console.error("Failed to save file metadata:", file.name);
          // Still add to local state for immediate use
          newFiles.push({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            content,
            type: file.type || "text/plain",
            size: file.size,
          });
        }
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        alert(`Error uploading file "${file.name}". Please try again.`);
      }
    }

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    // Automatically start analysis for uploaded files
    if (newFiles.length > 0) {
      analyzeAllFiles(newFiles);
    }

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeUploadedFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "js":
      case "jsx":
      case "ts":
      case "tsx":
        return <Code className="h-4 w-4 text-blue-500" />;
      case "py":
        return <Code className="h-4 w-4 text-yellow-500" />;
      case "java":
        return <Code className="h-4 w-4 text-orange-500" />;
      case "cpp":
      case "c":
        return <Code className="h-4 w-4 text-blue-600" />;
      case "html":
        return <FileText className="h-4 w-4 text-orange-600" />;
      case "css":
      case "scss":
        return <FileText className="h-4 w-4 text-blue-400" />;
      default:
        return <File className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="mx-auto max-w-2xl w-full py-8 space-y-6">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : 1));
              }}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink
              href="#"
              isActive={step === 1}
              onClick={(e) => {
                e.preventDefault();
                setStep(1);
              }}
            >
              1
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink
              href="#"
              isActive={step === 2}
              onClick={(e) => {
                e.preventDefault();
                if (canGoNext) setStep(2);
              }}
            >
              2
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink
              href="#"
              isActive={step === 3}
              onClick={(e) => {
                e.preventDefault();
                if (canGoToStep3) setStep(3);
              }}
            >
              3
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={!canGoNext && !canGoToStep3}
              onClick={(e) => {
                e.preventDefault();
                if (canGoToStep3) setStep(3);
                else if (canGoNext) setStep(2);
              }}
              className={
                !canGoNext && !canGoToStep3
                  ? "pointer-events-none opacity-50"
                  : undefined
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("upload")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "upload"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Upload & Analyze
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === "files"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <History className="h-4 w-4" />
            File History
          </button>
          <button
            onClick={() => setActiveTab("sessions")}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === "sessions"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Folder className="h-4 w-4" />
            Session History
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "upload" && (
        <div className="space-y-6">
          {step === 1 && (
            <div className="space-y-6">
              {/* Mode Selection */}
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">
                  Choose Your Input Method
                </h2>
                <p className="text-sm text-muted-foreground">
                  Select how you'd like to provide code for review.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant={uploadMode === "github" ? "default" : "outline"}
                    onClick={() => {
                      setUploadMode("github");
                      setSelectedRepo(null);
                      setUploadedFiles([]);
                    }}
                  >
                    GitHub Repository
                  </Button>
                  <Button
                    variant={uploadMode === "upload" ? "default" : "outline"}
                    onClick={() => {
                      setUploadMode("upload");
                      setSelectedRepo(null);
                      setUploadedFiles([]);
                    }}
                  >
                    Upload Files
                  </Button>
                </div>
              </div>

              {/* GitHub Repository Selection */}
              {uploadMode === "github" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="text-md font-medium">
                        Select a GitHub Repository
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Choose one of your repositories for code review.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        // manual refresh
                        setRepos([]);
                        setSelectedRepo(null);
                        setLoadingRepos(true);
                        if (!githubToken) return;
                        listUserRepos(githubToken as string)
                          .then((data) =>
                            setRepos(Array.isArray(data) ? data : [])
                          )
                          .catch(console.error)
                          .finally(() => setLoadingRepos(false));
                      }}
                    >
                      Refresh
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button disabled={loadingRepos}>
                          {selectedRepo
                            ? selectedRepo.full_name
                            : loadingRepos
                              ? "Loading repos..."
                              : "Open repositories"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-[320px] overflow-auto">
                        <DropdownMenuLabel>Your repositories</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {repos.length === 0 && (
                          <DropdownMenuItem disabled>
                            No repositories found
                          </DropdownMenuItem>
                        )}
                        {repos.map((repo) => (
                          <DropdownMenuItem
                            key={repo.id}
                            onSelect={() => handleSelectRepo(repo)}
                          >
                            {repo.full_name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="text-sm text-muted-foreground">
                      {selectedRepo ? (
                        <span>
                          Selected:{" "}
                          <span className="font-medium">
                            {selectedRepo.full_name}
                          </span>
                          {fetchingSelection && (
                            <span className="ml-2">(verifying...)</span>
                          )}
                        </span>
                      ) : (
                        <span>No repository selected</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* File Upload Section */}
              {uploadMode === "upload" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-md font-medium">Upload Code Files</h3>
                    <p className="text-sm text-muted-foreground">
                      Upload your code files for review. Supports multiple
                      programming languages.
                    </p>
                  </div>

                  {/* Upload Area */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600 mb-2">
                      Click to upload or drag and drop code files
                    </p>
                    <p className="text-xs text-gray-500 mb-4">
                      Supports: .js, .ts, .py, .java, .cpp, .html, .css, and
                      more
                    </p>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                    >
                      Choose Files
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".js,.ts,.jsx,.tsx,.py,.java,.cpp,.c,.cs,.php,.rb,.go,.rs,.swift,.kt,.scala,.r,.m,.sh,.bash,.zsh,.fish,.ps1,.bat,.cmd,.sql,.html,.css,.scss,.sass,.less,.vue,.svelte,.json,.xml,.yaml,.yml,.toml,.ini,.conf,.config"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  {/* Uploaded Files List */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">
                        Uploaded Files ({uploadedFiles.length})
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {uploadedFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              {getFileIcon(file.name)}
                              <div>
                                <p className="text-sm font-medium">
                                  {file.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeUploadedFile(file.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Code Analysis Results</h2>
                {uploadMode === "github" && selectedRepo && (
                  <p className="text-sm text-muted-foreground">
                    Repository:{" "}
                    <span className="font-medium">
                      {selectedRepo.full_name}
                    </span>
                  </p>
                )}
                {uploadMode === "upload" && uploadedFiles.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Analyzing:{" "}
                    <span className="font-medium">
                      {uploadedFiles.length} uploaded file
                      {uploadedFiles.length > 1 ? "s" : ""}
                    </span>
                    <span className="ml-2 text-xs">
                      ({uploadedFiles.map((f) => f.name).join(", ")})
                    </span>
                  </p>
                )}
              </div>

              {/* Analysis Status */}
              {isAnalyzing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-blue-800">
                      Analyzing code files...
                    </span>
                  </div>
                </div>
              )}

              {/* Analysis Results */}
              {analysisResults.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-md font-medium">Analysis Results</h3>
                  {analysisResults.map((result) => (
                    <div key={result.fileId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getFileIcon(result.fileName)}
                          <span className="font-medium">{result.fileName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {result.status === "pending" && (
                            <div className="flex items-center gap-1">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                              <span className="text-xs text-blue-600">
                                Analyzing...
                              </span>
                            </div>
                          )}
                          {result.status === "completed" && (
                            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                              ✓ Completed
                            </span>
                          )}
                          {result.status === "error" && (
                            <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                              ✗ Error
                            </span>
                          )}
                        </div>
                      </div>

                      {result.analysis && (
                        <div className="bg-gray-50 rounded p-3">
                          <h4 className="text-sm font-medium mb-2">
                            Analysis Notes:
                          </h4>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {result.analysis}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Continue Button */}
              {canGoToStep3 && (
                <div className="flex justify-center pt-4">
                  <Button
                    onClick={() => setStep(3)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Continue to Unit Test Generation
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Unit Test Generation</h2>
                <p className="text-sm text-muted-foreground">
                  Generate unit tests based on the code analysis results.
                </p>
              </div>

              {/* Analysis Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-md font-medium mb-2">Analysis Summary</h3>
                <div className="space-y-2">
                  {analysisResults.map((result) => (
                    <div
                      key={result.fileId}
                      className="flex items-center gap-2 text-sm"
                    >
                      {getFileIcon(result.fileName)}
                      <span className="font-medium">{result.fileName}</span>
                      <span className="text-green-600">✓ Analyzed</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unit Test Generation */}
              <div className="space-y-4">
                <h3 className="text-md font-medium">Generate Unit Tests</h3>
                <p className="text-sm text-muted-foreground">
                  Based on the analysis, we can now generate comprehensive unit
                  tests for your code.
                </p>

                <div className="border rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-2">
                    Available Actions:
                  </h4>
                  <div className="space-y-2">
                    <Button
                      className="w-full justify-start"
                      variant="outline"
                      onClick={generateUnitTestsForAllFiles}
                      disabled={isGeneratingTests || !canGoToStep3}
                    >
                      <Code className="h-4 w-4 mr-2" />
                      {isGeneratingTests
                        ? "Generating Unit Tests..."
                        : "Generate Unit Tests for All Files"}
                    </Button>
                    <Button
                      className="w-full justify-start"
                      variant="outline"
                      onClick={() => {
                        // TODO: Implement Docker agent creation
                        console.log("Create Docker agent for:", uploadedFiles);
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Create Docker Environment
                    </Button>
                  </div>
                </div>

                {/* Unit Test Generation Status */}
                {isGeneratingTests && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-blue-800">
                        Generating unit tests...
                      </span>
                    </div>
                  </div>
                )}

                {/* Unit Test Results */}
                {unitTestResults.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-md font-medium">
                      Generated Unit Tests
                    </h3>
                    {unitTestResults.map((result) => (
                      <div
                        key={result.fileId}
                        className="border rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {getFileIcon(result.fileName)}
                            <span className="font-medium">
                              {result.fileName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {result.status === "pending" && (
                              <div className="flex items-center gap-1">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                <span className="text-xs text-blue-600">
                                  Generating...
                                </span>
                              </div>
                            )}
                            {result.status === "completed" && (
                              <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                ✓ Generated
                              </span>
                            )}
                            {result.status === "error" && (
                              <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                                ✗ Error
                              </span>
                            )}
                          </div>
                        </div>

                        {result.unitTests && (
                          <div className="bg-gray-50 rounded p-3">
                            <h4 className="text-sm font-medium mb-2">
                              Generated Unit Tests:
                            </h4>
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-x-auto">
                              {result.unitTests}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Back Button */}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back to Analysis
                </Button>
                <Button
                  onClick={() => {
                    // TODO: Implement final execution
                    console.log("Execute tests and evaluate results");
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Execute & Evaluate
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* File History Tab */}
      {activeTab === "files" && (
        <FileHistory
          userId={undefined} // TODO: Get actual user ID from auth
          onFileSelect={(file) => {
            console.log("Selected file:", file);
            // TODO: Handle file selection - maybe open in editor or show details
          }}
          onFileDelete={(fileId) => {
            console.log("Deleted file:", fileId);
            // File deletion is handled in the component
          }}
        />
      )}

      {/* Session History Tab */}
      {activeTab === "sessions" && (
        <SessionHistory
          userId={undefined} // TODO: Get actual user ID from auth
          onSessionSelect={(session) => {
            console.log("Selected session:", session);
            // TODO: Handle session selection - maybe show session details
          }}
          onSessionDelete={(sessionId) => {
            console.log("Deleted session:", sessionId);
            // Session deletion is handled in the component
          }}
        />
      )}
    </div>
  );
}
