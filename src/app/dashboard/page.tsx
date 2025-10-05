"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// GitHub API functions moved to API routes
type DiscoveredFile = {
  path: string;
  name: string;
  extension: string;
  size: number;
  summary?: {
    lineCount: number;
    functions: string[];
    imports: string[];
  };
};

type FileSelection = {
  path: string;
  name: string;
  content: string;
  selected: boolean;
};
import {
  Authenticated,
  Unauthenticated,
  AuthLoading,
  useConvexAuth,
  useQuery,
} from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Upload, File, X, FileText, Code, History, Folder } from "lucide-react";
import FileHistory from "@/components/file-history";
import { Markdown } from "@/components/ui/markdown";
import SessionHistory from "@/components/session-history";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  RepositoryDropdown,
  BranchDropdown,
} from "@/components/ui/searchable-dropdown";
import { fuzzySearch } from "@/lib/fuzzy-search";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private?: boolean;
};

type GithubBranch = {
  name: string;
  commitSha?: string;
  protected?: boolean;
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
  const { isAuthenticated, isLoading } = useConvexAuth();
  const githubToken = useQuery(api.github.getGithubToken);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeTab, setActiveTab] = useState<"upload" | "files" | "sessions">(
    "upload"
  );
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [branches, setBranches] = useState<GithubBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState<boolean>(false);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [fetchingSelection, setFetchingSelection] = useState<boolean>(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadMode, setUploadMode] = useState<"github" | "upload">("github");
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [unitTestResults, setUnitTestResults] = useState<UnitTestResult[]>([]);
  const [isGeneratingTests, setIsGeneratingTests] = useState<boolean>(false);
  const [discoveredFiles, setDiscoveredFiles] = useState<DiscoveredFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileSelection[]>([]);
  const [isDiscoveringFiles, setIsDiscoveringFiles] = useState<boolean>(false);
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [filesPerPage] = useState<number>(10);
  const [fileSearchQuery, setFileSearchQuery] = useState<string>("");

  // File search and filtering
  const filteredFiles = useMemo(() => {
    if (!fileSearchQuery.trim()) {
      return discoveredFiles;
    }

    const matches = fuzzySearch(
      discoveredFiles,
      fileSearchQuery,
      (file) => `${file.name} ${file.path}`,
      { threshold: 0.1 }
    );

    return matches.map((match) => match.item);
  }, [discoveredFiles, fileSearchQuery]);

  // Pagination logic
  const totalPages = Math.ceil(filteredFiles.length / filesPerPage);
  const startIndex = (currentPage - 1) * filesPerPage;
  const endIndex = startIndex + filesPerPage;
  const currentPageFiles = filteredFiles.slice(startIndex, endIndex);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [fileSearchQuery]);

  const canGoNext = useMemo(
    () =>
      uploadMode === "github"
        ? Boolean(selectedRepo) && selectedFiles.length > 0
        : uploadedFiles.length > 0,
    [selectedRepo, uploadMode, uploadedFiles, selectedFiles]
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

  const analyzeSelectedFiles = async (files: FileSelection[]) => {
    if (!selectedRepo || !githubToken) return;

    setIsAnalyzing(true);
    const newAnalysisResults: AnalysisResult[] = [];

    // Initialize all files as pending
    files.forEach((file) => {
      newAnalysisResults.push({
        fileId: file.path, // Use path as ID for GitHub files
        fileName: file.name,
        analysis: "",
        status: "pending",
      });
    });

    setAnalysisResults(newAnalysisResults);

    try {
      // Use GitHub API to analyze all selected files intelligently
      const filePaths = files.map((f) => f.path);
      const response = await fetch("/api/github/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          owner: selectedRepo.owner.login,
          repo: selectedRepo.name,
          selectedFiles: filePaths,
          token: githubToken as string,
          ref: selectedBranch || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze files with GitHub API");
      }

      const analysisData = await response.json();
      const analysisResult = analysisData.result;

      // Display the actual analysis results from the GitHub API
      if (analysisResult && analysisResult.files) {
        analysisResult.files.forEach((fileAnalysis: any) => {
          setAnalysisResults((prev) =>
            prev.map((result) =>
              result.fileId === fileAnalysis.path
                ? {
                    ...result,
                    analysis:
                      fileAnalysis.analysis ||
                      "Analysis completed successfully",
                    status: "completed" as const,
                  }
                : result
            )
          );
        });
      } else {
        // Fallback if no specific file analysis is available
        files.forEach((file) => {
          setAnalysisResults((prev) =>
            prev.map((result) =>
              result.fileId === file.path
                ? {
                    ...result,
                    analysis:
                      analysisResult?.summary ||
                      "Analysis completed successfully",
                    status: "completed" as const,
                  }
                : result
            )
          );
        });
      }
    } catch (error) {
      console.error("Error analyzing files with GitHub API:", error);
      // Fallback to individual file analysis
      for (const file of files) {
        try {
          const analysis = await performCodeAnalysis({
            id: file.path,
            name: file.name,
            content: file.content,
            type: "text/plain",
            size: file.content.length,
          });

          setAnalysisResults((prev) =>
            prev.map((result) =>
              result.fileId === file.path
                ? { ...result, analysis, status: "completed" as const }
                : result
            )
          );
        } catch (fileError) {
          setAnalysisResults((prev) =>
            prev.map((result) =>
              result.fileId === file.path
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

      // Try to find file in uploaded files first, then in selected files
      let file = uploadedFiles.find((f) => f.id === analysisResult.fileId);
      if (!file && uploadMode === "github") {
        const selectedFile = selectedFiles.find(
          (f) => f.path === analysisResult.fileId
        );
        if (selectedFile) {
          file = {
            id: selectedFile.path,
            name: selectedFile.name,
            content: selectedFile.content,
            type: "text/plain",
            size: selectedFile.content.length,
          };
        }
      }

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
        if (!githubToken) return; // still or unauthenticated

        const response = await fetch(
          `/api/github/repos?token=${encodeURIComponent(githubToken as string)}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch repositories");
        }
        const data = await response.json();
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
    setBranches([]);
    setSelectedBranch(null);
    setDiscoveredFiles([]);
    setSelectedFiles([]);
    setCurrentPage(1); // Reset pagination to first page
    try {
      setFetchingSelection(true);
      setIsDiscoveringFiles(true);

      if (!githubToken) return;

      // Load branches for this repo (REST)
      try {
        setBranchesLoading(true);
        const br = await fetch("/api/github/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            owner: repo.owner.login,
            repo: repo.name,
            token: githubToken as string,
          }),
        });
        if (br.ok) {
          const data = await br.json();
          setBranches(Array.isArray(data) ? data : []);
          const defaultBranch = data?.find?.((b: any) => b?.name)?.name;
          if (defaultBranch) setSelectedBranch(defaultBranch);
        }
      } finally {
        setBranchesLoading(false);
      }

      // Do not discover files until a branch is explicitly selected
      // Files will be fetched on branch selection handler below

      // MCP will handle the repository analysis
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingSelection(false);
      setIsDiscoveringFiles(false);
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

  const handleFileSelection = async (
    file: DiscoveredFile,
    selected: boolean
  ) => {
    if (!selectedRepo || !githubToken) return;

    if (selected) {
      setLoadingFiles((prev) => new Set(prev).add(file.path));
      try {
        // For now, create a mock file selection since we don't have actual file content
        // In a real implementation, you would fetch the file content from GitHub
        const newFileSelection: FileSelection = {
          path: file.path,
          name: file.name,
          content: `// Mock content for ${file.name}\n// This would be the actual file content from GitHub`,
          selected: true,
        };

        setSelectedFiles((prev) => [...prev, newFileSelection]);
      } catch (error) {
        console.error(`Error loading file ${file.path}:`, error);
        alert(`Failed to load file "${file.name}". Please try again.`);
      } finally {
        setLoadingFiles((prev) => {
          const newSet = new Set(prev);
          newSet.delete(file.path);
          return newSet;
        });
      }
    } else {
      setSelectedFiles((prev) => prev.filter((f) => f.path !== file.path));
    }
  };

  const selectAllFiles = async () => {
    if (!selectedRepo || !githubToken || filteredFiles.length === 0) return;

    setIsDiscoveringFiles(true);
    try {
      const fileSelections: FileSelection[] = [];
      const failedFiles: string[] = [];

      for (const file of filteredFiles) {
        try {
          // For now, create mock content
          // In a real implementation, you would fetch the actual file content from GitHub
          const mockContent = `// Mock content for ${file.name}\n// This would be the actual file content from GitHub`;

          fileSelections.push({
            path: file.path,
            name: file.name,
            content: mockContent,
            selected: true,
          });
        } catch (error) {
          console.error(`Error loading file ${file.path}:`, error);
          failedFiles.push(file.name);
        }
      }

      setSelectedFiles(fileSelections);

      if (failedFiles.length > 0) {
        alert(
          `Failed to load ${failedFiles.length} file(s): ${failedFiles.join(", ")}`
        );
      }
    } catch (error) {
      console.error("Error selecting all files:", error);
      alert("Error loading files. Please try again.");
    } finally {
      setIsDiscoveringFiles(false);
    }
  };

  const deselectAllFiles = () => {
    setSelectedFiles([]);
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
      <AuthLoading>
        <div className="text-sm text-muted-foreground">
          Checking authentication…
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Sign in required</h2>
          <p className="text-sm text-muted-foreground">
            Please sign in to access your dashboard.
          </p>
          <Button
            onClick={() => (window.location.href = "/")}
            variant="outline"
          >
            Go to Sign in
          </Button>
        </div>
      </Unauthenticated>

      <Authenticated>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <Button
            variant="outline"
            onClick={async () => {
              const { authClient } = await import("@/lib/auth-client");
              await authClient.signOut();
              window.location.href = "/";
            }}
          >
            Sign out
          </Button>
        </div>

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
                        onClick={async () => {
                          // manual refresh
                          setRepos([]);
                          setSelectedRepo(null);
                          setLoadingRepos(true);
                          if (!githubToken) return;

                          try {
                            const response = await fetch(
                              `/api/github/repos?token=${encodeURIComponent(githubToken as string)}`
                            );
                            if (!response.ok) {
                              throw new Error("Failed to fetch repositories");
                            }
                            const data = await response.json();
                            setRepos(Array.isArray(data) ? data : []);
                          } catch (error) {
                            console.error(error);
                          } finally {
                            setLoadingRepos(false);
                          }
                        }}
                      >
                        Refresh
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <RepositoryDropdown
                        repos={repos}
                        selected={selectedRepo}
                        onSelect={handleSelectRepo}
                        loading={loadingRepos}
                      />

                      {/* Branch selector */}
                      {selectedRepo && (
                        <BranchDropdown
                          branches={branches}
                          selected={selectedBranch}
                          onSelect={async (branchName) => {
                            setSelectedBranch(branchName);
                            if (!selectedRepo || !githubToken) return;
                            // Re-discover files for chosen branch
                            setIsDiscoveringFiles(true);
                            try {
                              const response = await fetch(
                                "/api/github/discover",
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    owner: selectedRepo.owner.login,
                                    repo: selectedRepo.name,
                                    token: githubToken as string,
                                    ref: branchName,
                                  }),
                                }
                              );
                              if (response.ok) {
                                const files = await response.json();
                                setDiscoveredFiles(files);
                                setSelectedFiles([]);
                                setCurrentPage(1);
                                setFileSearchQuery(""); // Reset file search
                              }
                            } finally {
                              setIsDiscoveringFiles(false);
                            }
                          }}
                          loading={branchesLoading}
                        />
                      )}

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

                    {/* MCP AI File Discovery with Selection */}
                    {selectedRepo && (
                      <div className="space-y-4 mt-6">
                        <div className="space-y-2">
                          <h4 className="text-md font-medium">
                            Codemarshall helps sniff around ur repo
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            it will intelligently discover files in your
                            repository.
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Select the files you want to analyze and generate
                            unit tests for.
                          </p>
                        </div>

                        {/* File Discovery Status */}
                        {isDiscoveringFiles && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                              <Badge className="text-sm text-black p-2 gap-4 bg-white hover:bg-white">
                                <Spinner />
                                CodeMarshall is snooping around in your
                                repository...
                              </Badge>
                            </div>
                          </div>
                        )}

                        {/* File Selection with Checkboxes */}
                        {discoveredFiles.length > 0 && (
                          <div className="space-y-4">
                            {/* File Search Input */}
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="Search files..."
                                  value={fileSearchQuery}
                                  onChange={(e) =>
                                    setFileSearchQuery(e.target.value)
                                  }
                                  className="pl-9"
                                />
                              </div>
                              {fileSearchQuery && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setFileSearchQuery("")}
                                >
                                  Clear
                                </Button>
                              )}
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {filteredFiles.length} files found
                                  {fileSearchQuery &&
                                    filteredFiles.length !==
                                      discoveredFiles.length && (
                                      <span className="text-muted-foreground ml-1">
                                        (filtered from {discoveredFiles.length})
                                      </span>
                                    )}
                                  {totalPages > 1 && (
                                    <span className="text-muted-foreground ml-1">
                                      (showing {startIndex + 1}-
                                      {Math.min(endIndex, filteredFiles.length)}{" "}
                                      of {filteredFiles.length})
                                    </span>
                                  )}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  ({selectedFiles.length} selected)
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={selectAllFiles}
                                  disabled={isDiscoveringFiles}
                                >
                                  {fileSearchQuery
                                    ? "Select Filtered"
                                    : "Select All"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={deselectAllFiles}
                                  disabled={isDiscoveringFiles}
                                >
                                  Deselect All
                                </Button>
                              </div>
                            </div>

                            {/* File List with Checkboxes */}
                            <div className="max-h-64 overflow-y-auto border rounded-lg">
                              {currentPageFiles.map((file) => (
                                <div
                                  key={file.path}
                                  className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50"
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    <Checkbox
                                      checked={selectedFiles.some(
                                        (f) => f.path === file.path
                                      )}
                                      onCheckedChange={(checked) =>
                                        handleFileSelection(
                                          file,
                                          checked as boolean
                                        )
                                      }
                                      disabled={
                                        isDiscoveringFiles ||
                                        loadingFiles.has(file.path)
                                      }
                                    />
                                    <div className="flex items-center gap-2 flex-1">
                                      {getFileIcon(file.name)}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                          {file.name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {file.path} •{" "}
                                          {formatFileSize(file.size)}
                                          {file.summary && (
                                            <span>
                                              {" "}
                                              • {file.summary.lineCount} lines
                                            </span>
                                          )}
                                          {loadingFiles.has(file.path) && (
                                            <span className="ml-2 text-blue-600">
                                              Loading...
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                              <div className="flex flex-col items-center gap-2 pt-4">
                                <div className="text-sm text-muted-foreground">
                                  Page {currentPage} of {totalPages}
                                </div>
                                <Pagination>
                                  <PaginationContent>
                                    <PaginationItem>
                                      <PaginationPrevious
                                        href="#"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          if (currentPage > 1) {
                                            setCurrentPage(currentPage - 1);
                                          }
                                        }}
                                        className={
                                          currentPage <= 1
                                            ? "pointer-events-none opacity-50"
                                            : "cursor-pointer"
                                        }
                                      />
                                    </PaginationItem>

                                    {/* Page Numbers */}
                                    {Array.from(
                                      { length: totalPages },
                                      (_, i) => i + 1
                                    ).map((pageNum) => {
                                      // Show first page, last page, current page, and pages around current
                                      const showPage =
                                        pageNum === 1 ||
                                        pageNum === totalPages ||
                                        Math.abs(pageNum - currentPage) <= 1;

                                      if (!showPage) {
                                        // Show ellipsis for gaps
                                        if (pageNum === 2 && currentPage > 3) {
                                          return (
                                            <PaginationItem
                                              key={`ellipsis-${pageNum}`}
                                            >
                                              <PaginationEllipsis />
                                            </PaginationItem>
                                          );
                                        }
                                        if (
                                          pageNum === totalPages - 1 &&
                                          currentPage < totalPages - 2
                                        ) {
                                          return (
                                            <PaginationItem
                                              key={`ellipsis-${pageNum}`}
                                            >
                                              <PaginationEllipsis />
                                            </PaginationItem>
                                          );
                                        }
                                        return null;
                                      }

                                      return (
                                        <PaginationItem key={pageNum}>
                                          <PaginationLink
                                            href="#"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              setCurrentPage(pageNum);
                                            }}
                                            isActive={currentPage === pageNum}
                                            className="cursor-pointer"
                                          >
                                            {pageNum}
                                          </PaginationLink>
                                        </PaginationItem>
                                      );
                                    })}

                                    <PaginationItem>
                                      <PaginationNext
                                        href="#"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          if (currentPage < totalPages) {
                                            setCurrentPage(currentPage + 1);
                                          }
                                        }}
                                        className={
                                          currentPage >= totalPages
                                            ? "pointer-events-none opacity-50"
                                            : "cursor-pointer"
                                        }
                                      />
                                    </PaginationItem>
                                  </PaginationContent>
                                </Pagination>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Continue to Code Review Button */}
                        {selectedFiles.length > 0 && (
                          <div className="flex justify-center pt-4">
                            <Button
                              onClick={() => setStep(2)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              Continue to Code Review ({selectedFiles.length}{" "}
                              files selected)
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
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
                  <h2 className="text-lg font-semibold">
                    Code Analysis Results
                  </h2>
                  {uploadMode === "github" && selectedRepo && (
                    <p className="text-sm text-muted-foreground">
                      Repository:{" "}
                      <span className="font-medium">
                        {selectedRepo.full_name}
                      </span>
                      {selectedFiles.length > 0 && (
                        <span className="ml-2">
                          • {selectedFiles.length} file
                          {selectedFiles.length > 1 ? "s" : ""} selected
                        </span>
                      )}
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

                {/* Start AI Analysis Button for GitHub Mode */}
                {uploadMode === "github" &&
                  selectedFiles.length > 0 &&
                  analysisResults.length === 0 &&
                  !isAnalyzing && (
                    <div className="flex justify-center pt-4">
                      <Button
                        onClick={() => analyzeSelectedFiles(selectedFiles)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Start AI Analysis for {selectedFiles.length} Selected
                        Files
                      </Button>
                    </div>
                  )}

                {/* Analysis Results */}
                {analysisResults.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-md font-medium">Analysis Results</h3>
                    {analysisResults.map((result) => (
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
                            <Markdown className="prose dark:prose-invert">
                              {result.analysis}
                            </Markdown>
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
                  <h2 className="text-lg font-semibold">
                    Unit Test Generation
                  </h2>
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
                    Based on the analysis, we can now generate comprehensive
                    unit tests for your code.
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
                          console.log(
                            "Create Docker agent for:",
                            uploadedFiles
                          );
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
                              <Markdown className="prose dark:prose-invert">
                                {result.unitTests.includes("```")
                                  ? result.unitTests
                                  : `\n\n\`\`\`\n${result.unitTests}\n\`\`\`\n`}
                              </Markdown>
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
            userId={undefined}
            onFileSelect={(file) => {
              console.log("Selected file:", file);
            }}
            onFileDelete={(fileId) => {
              console.log("Deleted file:", fileId);
            }}
          />
        )}

        {/* Session History Tab */}
        {activeTab === "sessions" && (
          <SessionHistory
            userId={undefined}
            onSessionSelect={(session) => {
              console.log("Selected session:", session);
            }}
            onSessionDelete={(sessionId) => {
              console.log("Deleted session:", sessionId);
            }}
          />
        )}
      </Authenticated>
    </div>
  );
}
