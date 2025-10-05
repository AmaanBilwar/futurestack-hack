"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "./ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  File,
  Search,
  Clock,
  User,
  MoreVertical,
  Download,
  Trash2,
  Eye,
  Code,
  FileText,
  Calendar,
  Filter,
} from "lucide-react";

interface FileHistoryItem {
  _id: string;
  name: string;
  storageId: string;
  type: string;
  size: number;
  userId?: string;
  uploadedAt: number;
  metadata?: {
    language?: string;
    extension?: string;
    lines?: number;
    characters?: number;
  };
}

interface FileHistoryProps {
  userId?: string;
  onFileSelect?: (file: FileHistoryItem) => void;
  onFileDelete?: (fileId: string) => void;
}

export default function FileHistory({
  userId,
  onFileSelect,
  onFileDelete,
}: FileHistoryProps) {
  const [files, setFiles] = useState<FileHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLanguage, setFilterLanguage] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    loadFiles();
  }, [userId]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/files?userId=${userId || ""}`);
      const data = await response.json();

      if (data.success) {
        setFiles(data.files);
      }
    } catch (error) {
      console.error("Error loading files:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const response = await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });

      if (response.ok) {
        setFiles(files.filter((f) => f._id !== fileId));
        onFileDelete?.(fileId);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const handleDownloadFile = async (file: FileHistoryItem) => {
    try {
      // Fetch file content from storage
      const response = await fetch(`/api/files?storageId=${file.storageId}`);
      const data = await response.json();

      if (data.success && data.content) {
        const blob = new Blob([data.content], { type: file.type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        console.error("Failed to fetch file content");
      }
    } catch (error) {
      console.error("Error downloading file:", error);
    }
  };

  const filteredFiles = files
    .filter((file) => {
      const matchesSearch = file.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesLanguage =
        filterLanguage === "all" || file.metadata?.language === filterLanguage;
      return matchesSearch && matchesLanguage;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "date":
          comparison = a.uploadedAt - b.uploadedAt;
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "size":
          comparison = a.size - b.size;
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  const languages = Array.from(
    new Set(files.map((f) => f.metadata?.language).filter(Boolean)),
  );

  const getFileIcon = (fileName: string, language?: string) => {
    if (language) {
      switch (language) {
        case "javascript":
        case "typescript":
          return <Code className="h-4 w-4 text-blue-500" />;
        case "python":
          return <Code className="h-4 w-4 text-yellow-500" />;
        case "java":
          return <Code className="h-4 w-4 text-orange-500" />;
        case "html":
          return <FileText className="h-4 w-4 text-orange-600" />;
        case "css":
          return <FileText className="h-4 w-4 text-blue-400" />;
        default:
          return <File className="h-4 w-4 text-gray-500" />;
      }
    }
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading files...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">File History</h2>
          <p className="text-muted-foreground">
            {files.length} file{files.length !== 1 ? "s" : ""} uploaded
          </p>
        </div>
        <Button onClick={loadFiles} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="justify-start">
              <Filter className="h-4 w-4 mr-2" />
              {filterLanguage === "all" ? "All Languages" : filterLanguage}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilterLanguage("all")}>
              All Languages
            </DropdownMenuItem>
            {languages.map((lang) => (
              <DropdownMenuItem
                key={lang}
                onClick={() => setFilterLanguage(lang!)}
              >
                {lang}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="justify-start">
              <Calendar className="h-4 w-4 mr-2" />
              Sort: {sortBy} ({sortOrder})
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => {
                setSortBy("date");
                setSortOrder("desc");
              }}
            >
              Date (Newest)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSortBy("date");
                setSortOrder("asc");
              }}
            >
              Date (Oldest)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSortBy("name");
                setSortOrder("asc");
              }}
            >
              Name (A-Z)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSortBy("name");
                setSortOrder("desc");
              }}
            >
              Name (Z-A)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSortBy("size");
                setSortOrder("desc");
              }}
            >
              Size (Largest)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSortBy("size");
                setSortOrder("asc");
              }}
            >
              Size (Smallest)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Files List */}
      {filteredFiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <File className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No files found</h3>
            <p className="text-muted-foreground text-center">
              {searchTerm || filterLanguage !== "all"
                ? "Try adjusting your search or filters"
                : "Upload some files to see them here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredFiles.map((file) => (
            <Card key={file._id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getFileIcon(file.name, file.metadata?.language)}
                    <div>
                      <CardTitle className="text-base">{file.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>{file.metadata?.lines || 0} lines</span>
                        <span>•</span>
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(file.uploadedAt)}</span>
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {file.metadata?.language && (
                      <Badge variant="secondary">
                        {file.metadata.language}
                      </Badge>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onFileSelect?.(file)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDownloadFile(file)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteFile(file._id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
