"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Select, 
  Group,
  Text,
  Loader
} from "@mantine/core";
import axiosInstance from "@/utils/axios";

interface VideoData {
  _id: string;
  title: string;
  duration?: number; // Duration in seconds
}

interface VideoSelectorProps {
  value: string | null | { _id: string; title?: string; status?: string };
  onChange: (videoId: string | null) => void;
  label?: string;
  required?: boolean;
  error?: string;
}

export default function VideoSelector({
  value,
  onChange,
  label = "Video",
  required = false,
  error
}: VideoSelectorProps) {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Format duration from seconds to MM:SS or HH:MM:SS
  const formatDuration = (seconds?: number): string => {
    // console.log("seconds", seconds);
    if (!seconds) return "Unknown";
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Fetch available videos with optional search
  const fetchVideos = async (searchTerm = "") => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (searchTerm) {
        params.append("q", searchTerm);
      }
      
      const response = await axiosInstance.get(`/api/videos?${params.toString()}`);
      
      // Extract only _id, title and duration from each video
      const simplifiedVideos = response.data.videos.map((video: any) => ({
        _id: video._id,
        title: video.title,
        duration: video.duration
      }));
      
      setVideos(simplifiedVideos);
    } catch (error) {
      console.error("Error fetching videos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (searchTerm: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (searchTerm.trim()) {
            fetchVideos(searchTerm);
          } else {
            fetchVideos();
          }
        }, 300);
      };
    })(),
    []
  );

  useEffect(() => {
    fetchVideos();
  }, []);

  // Handle search input change from Select component
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

  // Extract video ID from value if it's an object
  const getVideoId = () => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value._id) return value._id;
    return null;
  };

  return (
    <Select
      label={label}
      placeholder="Search and select a video..."
      data={videos.map(video => ({
        value: video._id,
        label: `${video.title} (${formatDuration(video.duration)})`
      }))}
      value={getVideoId()}
      onChange={onChange}
      onSearchChange={handleSearchChange}
      searchable
      clearable
      required={required}
      error={error}
      rightSection={loading ? <Loader size="xs" /> : null}
      rightSectionWidth={40}
      styles={{ rightSection: { pointerEvents: 'none' } } as any}
    />
  );
} 