"use client";

import { useState, useEffect } from "react";
import { Select, Loader } from "@mantine/core";
import axiosInstance from "@/utils/axios";

interface User {
  _id: string;
  name: string;
  userName: string;
  profilePicture?: string;
  role: string;
}

interface AuthorSelectorProps {
  value: string;
  onChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  mb?: string | number;
  disabled?: boolean;
  currentAuthor?: {
    _id: string;
    name: string;
    userName: string;
    profilePicture?: string;
    role?: string;
  };
}

export default function AuthorSelector({
  value,
  onChange,
  label = "Author",
  placeholder = "Select author",
  required = false,
  error,
  mb = "md",
  disabled = false,
  currentAuthor,
}: AuthorSelectorProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Fetch current author details if only ID is provided
  const fetchCurrentAuthor = async (authorId: string): Promise<User | null> => {
    try {
      const response = await axiosInstance.get(`/api/user/${authorId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching current author:", error);
      return null;
    }
  };

  // Fetch latest 10 instructors and influencers
  const fetchAuthors = async () => {
    try {
      setLoading(true);
      
      // Get current author if value is provided but currentAuthor object is not
      let currentAuthorData = currentAuthor;
      if (value && !currentAuthorData) {
        const fetchedAuthor = await fetchCurrentAuthor(value);
        currentAuthorData = fetchedAuthor || undefined;
      }
      
      // First try to get instructors
      const instructorResponse = await axiosInstance.get("/api/user/all", {
        params: {
          role: "instructor",
          limit: 5,
          sort: "createdAt",
          order: "desc", // Latest first
        },
      });
      
      // Then try to get influencers
      const influencerResponse = await axiosInstance.get("/api/user/all", {
        params: {
          role: "influencer", 
          limit: 5,
          sort: "createdAt",
          order: "desc", // Latest first
        },
      });
      
      const instructors = instructorResponse.data.data || [];
      const influencers = influencerResponse.data.data || [];
      let combinedUsers = [...instructors, ...influencers];
      
      // Add current author if provided and not already in the list
      if (currentAuthorData && !combinedUsers.find(user => user._id === currentAuthorData._id)) {
        combinedUsers.unshift(currentAuthorData);
      }
      
      setUsers(combinedUsers.slice(0, 10));
    } catch (error) {
      console.error("Error fetching authors:", error);
      // Fallback to all users if specific role filter fails
      try {
        const response = await axiosInstance.get("/api/user/all", {
          params: {
            limit: 10,
            sort: "createdAt",
            order: "desc",
          },
        });
        const userData = response.data.data || response.data;
        setUsers(userData);
      } catch (fallbackError) {
        console.error("Error fetching users:", fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  // Search users based on search value
  const searchUsers = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      fetchAuthors(); // Reset to default 10 users
      return;
    }

    try {
      setLoading(true);
      // Search for instructors
      const instructorResponse = await axiosInstance.get("/api/user/all", {
        params: {
          role: "instructor",
          search: searchTerm,
          limit: 10,
        },
      });
      
      // Search for influencers
      const influencerResponse = await axiosInstance.get("/api/user/all", {
        params: {
          role: "influencer",
          search: searchTerm,
          limit: 10,
        },
      });
      
      const instructors = instructorResponse.data.data || [];
      const influencers = influencerResponse.data.data || [];
      const combinedUsers = [...instructors, ...influencers].slice(0, 20);
      
      setUsers(combinedUsers);
    } catch (error) {
      console.error("Error searching users:", error);
      // Fallback search without role filter
      try {
        const response = await axiosInstance.get("/api/user/all", {
          params: {
            search: searchTerm,
            limit: 20,
          },
        });
        const userData = response.data.data || response.data;
        setUsers(userData);
      } catch (fallbackError) {
        console.error("Error searching users:", fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthors();
  }, []);

  const handleSearchChange = (searchValue: string) => {
    setSearchValue(searchValue);
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      searchUsers(searchValue);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const userOptions = users.map((user) => ({
    value: user._id,
    label: `${user.name} (${user.userName})`,
    // Add role info if available
    ...(user.role && { description: user.role }),
  }));

  return (
    <Select
      label={label}
      placeholder={placeholder}
      data={userOptions}
      value={value}
      onChange={onChange}
      required={required}
      searchable
      searchValue={searchValue}
      onSearchChange={handleSearchChange}
      error={error}
      mb={mb}
      disabled={disabled}
      rightSection={loading ? <Loader size="xs" /> : undefined}
      nothingFoundMessage={
        searchValue ? "No authors found matching your search" : "No authors available"
      }
      clearable
    />
  );
}
