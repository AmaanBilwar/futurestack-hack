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
  Folder,
  Search,
  Clock,
  User,
  MoreVertical,
  Trash2,
  Eye,
  Code,
  FileText,
  Calendar,
  Filter,
  Archive,
  CheckCircle,
  Activity,
} from "lucide-react";

interface SessionItem {
  _id: string;
  name: string;
  description?: string;
  userId?: string;
  createdAt: number;
  updatedAt: number;
  status: "active" | "completed" | "archived";
  metadata?: {
    fileCount?: number;
    analysisCount?: number;
    testCount?: number;
    sourceType?: "upload" | "github";
    githubRepo?: string;
  };
}

interface SessionHistoryProps {
  userId?: string;
  onSessionSelect?: (session: SessionItem) => void;
  onSessionDelete?: (sessionId: string) => void;
}

export default function SessionHistory({
  userId,
  onSessionSelect,
  onSessionDelete,
}: SessionHistoryProps) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "name">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    loadSessions();
  }, [userId]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sessions?userId=${userId || ""}`);
      const data = await response.json();

      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions?sessionId=${sessionId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSessions(sessions.filter((s) => s._id !== sessionId));
        onSessionDelete?.(sessionId);
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const handleUpdateSessionStatus = async (
    sessionId: string,
    status: "active" | "completed" | "archived"
  ) => {
    try {
      const response = await fetch("/api/sessions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, status }),
      });

      if (response.ok) {
        setSessions(
          sessions.map((s) => (s._id === sessionId ? { ...s, status } : s))
        );
      }
    } catch (error) {
      console.error("Error updating session:", error);
    }
  };

  const filteredSessions = sessions
    .filter((session) => {
      const matchesSearch =
        session.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (session.description &&
          session.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus =
        filterStatus === "all" || session.status === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "date":
          comparison = a.createdAt - b.createdAt;
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Activity className="h-4 w-4 text-blue-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "archived":
        return <Archive className="h-4 w-4 text-gray-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      case "archived":
        return <Badge variant="outline">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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

  const getRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading sessions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Session History</h2>
          <p className="text-muted-foreground">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""} created
          </p>
        </div>
        <Button onClick={loadSessions} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search sessions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="justify-start">
              <Filter className="h-4 w-4 mr-2" />
              {filterStatus === "all" ? "All Status" : filterStatus}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilterStatus("all")}>
              All Status
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterStatus("active")}>
              Active
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterStatus("completed")}>
              Completed
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterStatus("archived")}>
              Archived
            </DropdownMenuItem>
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Sessions List */}
      {filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Folder className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No sessions found</h3>
            <p className="text-muted-foreground text-center">
              {searchTerm || filterStatus !== "all"
                ? "Try adjusting your search or filters"
                : "Create some sessions to see them here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredSessions.map((session) => (
            <Card
              key={session._id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(session.status)}
                    <div>
                      <CardTitle className="text-base">
                        {session.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {session.metadata?.fileCount && (
                          <>
                            <FileText className="h-3 w-3" />
                            <span>{session.metadata.fileCount} files</span>
                          </>
                        )}
                        {session.metadata?.analysisCount && (
                          <>
                            <Code className="h-3 w-3" />
                            <span>
                              {session.metadata.analysisCount} analyses
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <Clock className="h-3 w-3" />
                        <span>{getRelativeTime(session.createdAt)}</span>
                        <span>•</span>
                        <span>{formatDate(session.createdAt)}</span>
                      </CardDescription>
                      {session.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {session.description}
                        </p>
                      )}
                      {session.metadata?.githubRepo && (
                        <Badge variant="outline" className="mt-1">
                          GitHub: {session.metadata.githubRepo}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(session.status)}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onSessionSelect?.(session)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        {session.status === "active" && (
                          <DropdownMenuItem
                            onClick={() =>
                              handleUpdateSessionStatus(
                                session._id,
                                "completed"
                              )
                            }
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark Completed
                          </DropdownMenuItem>
                        )}
                        {session.status === "completed" && (
                          <DropdownMenuItem
                            onClick={() =>
                              handleUpdateSessionStatus(session._id, "archived")
                            }
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                        )}
                        {session.status === "archived" && (
                          <DropdownMenuItem
                            onClick={() =>
                              handleUpdateSessionStatus(session._id, "active")
                            }
                          >
                            <Activity className="h-4 w-4 mr-2" />
                            Restore
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDeleteSession(session._id)}
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
