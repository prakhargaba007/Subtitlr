"use client";
import React, { useState, useEffect } from "react";
import {
  Users,
  Eye,
  Video,
  GraduationCap,
  DollarSign,
  Activity,
  CheckCircle,
  Clock,
  TrendingUp,
  User,
  CreditCard,
  Trophy,
  FileText,
  Settings,
  Upload,
  BarChart3,
  UserCog,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { BarChart } from "@mantine/charts";
import { getDashboardStats, getTimeBasedStats } from "@/utils/api";

// Types for dashboard data
interface DashboardStats {
  overview: {
    totalUsers: number;
    totalViews: number;
    totalVideos: number;
    coursesSold: number;
  };
  detailed: {
    activeUsers: number;
    publishedVideos: number;
    completedCourses: number;
    paidEnrollments: number;
  };
  timestamp: string;
}

interface TimeBasedStats {
  period: string;
  startDate: string;
  endDate: string;
  stats: {
    newUsers: number;
    newViews: number;
    newVideos: number;
    newEnrollments: number;
  };
  timestamp: string;
}

// Static data for charts and activities (can be replaced with real data later)
const staticData = {
  recentActivity: [
    {
      type: "user",
      message: "New user registration: John Doe",
      time: "2 minutes ago",
      icon: User,
    },
    {
      type: "course",
      message: "Course 'Advanced Poker Strategies' completed by 15 users",
      time: "5 minutes ago",
      icon: GraduationCap,
    },
    {
      type: "payment",
      message: "Payment received: $299.00 for Premium Membership",
      time: "8 minutes ago",
      icon: CreditCard,
    },
    {
      type: "video",
      message: "New video uploaded: 'Texas Hold'em Basics'",
      time: "12 minutes ago",
      icon: Video,
    },
    {
      type: "badge",
      message: "50 users earned 'First Win' badge",
      time: "15 minutes ago",
      icon: Trophy,
    },
    {
      type: "quiz",
      message: "Quiz 'Poker Math Fundamentals' has 89% completion rate",
      time: "18 minutes ago",
      icon: FileText,
    },
  ],
  topCourses: [
    {
      name: "Texas Hold'em Mastery",
      students: 2341,
      revenue: "$45,230",
      rating: 4.9,
    },
    {
      name: "Advanced Bluffing Techniques",
      students: 1876,
      revenue: "$38,420",
      rating: 4.8,
    },
    {
      name: "Poker Math Fundamentals",
      students: 1654,
      revenue: "$32,180",
      rating: 4.7,
    },
    {
      name: "Tournament Strategy Guide",
      students: 1423,
      revenue: "$28,950",
      rating: 4.6,
    },
    {
      name: "Cash Game Profits",
      students: 1234,
      revenue: "$25,670",
      rating: 4.8,
    },
  ],
  monthlyStats: {
    userData: [
      { month: "Jan", users: 8500 },
      { month: "Feb", users: 9200 },
      { month: "Mar", users: 10100 },
      { month: "Apr", users: 10800 },
      { month: "May", users: 11500 },
      { month: "Jun", users: 12847 },
    ],
    revenueData: [
      { month: "Jan", revenue: 85000 },
      { month: "Feb", revenue: 92000 },
      { month: "Mar", revenue: 101000 },
      { month: "Apr", revenue: 108000 },
      { month: "May", revenue: 115000 },
      { month: "Jun", revenue: 127430 },
    ],
  },
};

function MetricCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  colorScheme,
  isLoading = false,
}: any) {
  const getTrendColor = (trend: string) => {
    return trend === "up" ? "text-green-600" : "text-red-600";
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toLocaleString();
  };

  const colorClasses = {
    blue: {
      bg: "bg-blue-500",
      lightBg: "bg-blue-50",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      borderColor: "border-blue-200",
    },
    green: {
      bg: "bg-green-500",
      lightBg: "bg-green-50",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      borderColor: "border-green-200",
    },
    purple: {
      bg: "bg-purple-500",
      lightBg: "bg-purple-50",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      borderColor: "border-purple-200",
    },
    orange: {
      bg: "bg-orange-500",
      lightBg: "bg-orange-50",
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      borderColor: "border-orange-200",
    },
    red: {
      bg: "bg-red-500",
      lightBg: "bg-red-50",
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      borderColor: "border-red-200",
    },
    indigo: {
      bg: "bg-indigo-500",
      lightBg: "bg-indigo-50",
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      borderColor: "border-indigo-200",
    },
    teal: {
      bg: "bg-teal-500",
      lightBg: "bg-teal-50",
      iconBg: "bg-teal-100",
      iconColor: "text-teal-600",
      borderColor: "border-teal-200",
    },
    pink: {
      bg: "bg-pink-500",
      lightBg: "bg-pink-50",
      iconBg: "bg-pink-100",
      iconColor: "text-pink-600",
      borderColor: "border-pink-200",
    },
  };

  const colors =
    colorClasses[colorScheme as keyof typeof colorClasses] || colorClasses.blue;

  return (
    <div
      className={`bg-white p-6 rounded-xl shadow border ${colors.borderColor} hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colors.iconBg}`}>
          <Icon className={`h-6 w-6 ${colors.iconColor}`} />
        </div>
        {change && (
          <div className={`text-sm font-medium ${getTrendColor(trend)}`}>
            <span className="inline-flex items-center">
              <TrendingUp className="h-4 w-4 mr-1" /> {change}
            </span>
          </div>
        )}
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-1">
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="text-gray-400">Loading...</span>
          </div>
        ) : typeof value === "number" ? (
          formatNumber(value)
        ) : (
          value
        )}
      </h3>
      <p className="text-gray-600 text-sm">{title}</p>
      <div className={`mt-4 h-1 w-full rounded-full ${colors.lightBg}`}>
        <div
          className={`h-1 rounded-full ${colors.bg} transition-all duration-1000`}
          style={{ width: "85%" }}
        ></div>
      </div>
    </div>
  );
}

function ActivityItem({ activity }: any) {
  const IconComponent = activity.icon;

  const getActivityColor = (type: string) => {
    const colors = {
      user: "bg-blue-100 text-blue-600",
      course: "bg-green-100 text-green-600",
      payment: "bg-emerald-100 text-emerald-600",
      video: "bg-purple-100 text-purple-600",
      badge: "bg-yellow-100 text-yellow-600",
      quiz: "bg-indigo-100 text-indigo-600",
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-600";
  };

  const iconColor = getActivityColor(activity.type);

  return (
    <div className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
      <div className={`p-2 rounded-lg ${iconColor}`}>
        <IconComponent className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-gray-900 text-sm">{activity.message}</p>
        <p className="text-gray-500 text-xs">{activity.time}</p>
      </div>
    </div>
  );
}

function CourseItem({ course }: any) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors">
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900">{course.name}</h4>
        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
          <span className="flex items-center">
            <Users className="h-4 w-4 mr-1" />{" "}
            {course.students.toLocaleString()} students
          </span>
          <span className="flex items-center">
            <DollarSign className="h-4 w-4 mr-1" /> {course.revenue}
          </span>
          <span className="flex items-center">
            <Trophy className="h-4 w-4 mr-1" /> {course.rating}/5
          </span>
        </div>
      </div>
    </div>
  );
}

function page() {
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(
    null
  );
  const [timeBasedStats, setTimeBasedStats] = useState<TimeBasedStats | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [chartsMounted, setChartsMounted] = useState(false);

  useEffect(() => {
    setChartsMounted(true);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [statsResponse, timeStatsResponse] = await Promise.all([
        getDashboardStats(),
        getTimeBasedStats(30),
      ]);

      setDashboardStats(statsResponse.data);
      setTimeBasedStats(timeStatsResponse.data);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      setError(err.response?.data?.message || "Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    fetchDashboardData();
  };

  return (
    <div className="min-h-screen p-2">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Dashboard Overview
              </h1>
              <p className="text-gray-600">
                Welcome back! Here's what's happening with Kili Labs
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-red-800 font-medium">
                Error loading dashboard data
              </p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Users"
            value={dashboardStats?.overview.totalUsers}
            change={
              timeBasedStats
                ? `+${timeBasedStats.stats.newUsers} (30d)`
                : undefined
            }
            trend="up"
            icon={Users}
            colorScheme="blue"
            isLoading={isLoading}
          />
          <MetricCard
            title="Total Views"
            value={dashboardStats?.overview.totalViews}
            change={
              timeBasedStats
                ? `+${timeBasedStats.stats.newViews} (30d)`
                : undefined
            }
            trend="up"
            icon={Eye}
            colorScheme="green"
            isLoading={isLoading}
          />
          <MetricCard
            title="Total Videos"
            value={dashboardStats?.overview.totalVideos}
            change={
              timeBasedStats
                ? `+${timeBasedStats.stats.newVideos} (30d)`
                : undefined
            }
            trend="up"
            icon={Video}
            colorScheme="purple"
            isLoading={isLoading}
          />
          <MetricCard
            title="Courses Sold"
            value={dashboardStats?.overview.coursesSold}
            change={
              timeBasedStats
                ? `+${timeBasedStats.stats.newEnrollments} (30d)`
                : undefined
            }
            trend="up"
            icon={GraduationCap}
            colorScheme="orange"
            isLoading={isLoading}
          />
        </div>

        {/* Additional Metrics Grid */}
        {/* {dashboardStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Active Users"
              value={dashboardStats.detailed.activeUsers}
              icon={User}
              colorScheme="teal"
              isLoading={false}
            />
            <MetricCard
              title="Published Videos"
              value={dashboardStats.detailed.publishedVideos}
              icon={Video}
              colorScheme="indigo"
              isLoading={false}
            />
            <MetricCard
              title="Completed Courses"
              value={dashboardStats.detailed.completedCourses}
              icon={CheckCircle}
              colorScheme="green"
              isLoading={false}
            />
            <MetricCard
              title="Paid Enrollments"
              value={dashboardStats.detailed.paidEnrollments}
              icon={CreditCard}
              colorScheme="pink"
              isLoading={false}
            />
          </div>
        )} */}

        {/* Charts and Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Monthly Users Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow border border-gray-100 hover:shadow-xl transition-shadow">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <div className="p-2 rounded-lg bg-blue-100 mr-3">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              Monthly User Growth
            </h3>
            <div className="h-80 w-full min-w-0 min-h-[300px]">
              {chartsMounted && (
                <BarChart
                  h={300}
                  w="100%"
                  data={staticData.monthlyStats.userData}
                  dataKey="month"
                  series={[{ name: "users", color: "blue.6" }]}
                  tickLine="xy"
                  gridAxis="xy"
                  withLegend
                  legendProps={{ verticalAlign: "bottom", height: 50 }}
                />
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-xl shadow border border-gray-100 hover:shadow-xl transition-shadow">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <div className="p-2 rounded-lg bg-green-100 mr-3">
                <Activity className="h-5 w-5 text-green-600" />
              </div>
              Recent Activity
            </h3>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {staticData.recentActivity.map((activity, index) => (
                <ActivityItem key={index} activity={activity} />
              ))}
            </div>
          </div>
        </div>

        {/* Revenue Chart and Top Courses */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Revenue Chart */}
          <div className="bg-white p-6 rounded-xl shadow border border-gray-100 hover:shadow-xl transition-shadow">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <div className="p-2 rounded-lg bg-green-100 mr-3">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              Monthly Revenue
            </h3>
            <div className="h-80 w-full min-w-0 min-h-[300px]">
              {chartsMounted && (
                <BarChart
                  h={300}
                  w="100%"
                  data={staticData.monthlyStats.revenueData}
                  dataKey="month"
                  series={[{ name: "revenue", color: "green.6" }]}
                  tickLine="xy"
                  gridAxis="xy"
                  withLegend
                  legendProps={{ verticalAlign: "bottom", height: 50 }}
                  valueFormatter={(value) => `$${value.toLocaleString()}`}
                />
              )}
            </div>
          </div>

          {/* Top Courses */}
          <div className="bg-white p-6 rounded-xl shadow border border-gray-100 hover:shadow-xl transition-shadow">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <div className="p-2 rounded-lg bg-purple-100 mr-3">
                <Trophy className="h-5 w-5 text-purple-600" />
              </div>
              Top Performing Courses
            </h3>
            <div className="space-y-2">
              {staticData.topCourses.map((course, index) => (
                <CourseItem key={index} course={course} />
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white p-6 rounded-xl shadow border border-gray-100 hover:shadow-xl transition-shadow">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <div className="p-2 rounded-lg bg-orange-100 mr-3">
              <Settings className="h-5 w-5 text-orange-600" />
            </div>
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 text-center transform hover:scale-105 shadow hover:shadow-xl">
              <UserCog className="h-8 w-8 mx-auto mb-2" />
              <div className="font-semibold">Manage Users</div>
            </button>
            <button className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300 text-center transform hover:scale-105 shadow hover:shadow-xl">
              <Upload className="h-8 w-8 mx-auto mb-2" />
              <div className="font-semibold">Upload Content</div>
            </button>
            <button className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-300 text-center transform hover:scale-105 shadow hover:shadow-xl">
              <BarChart3 className="h-8 w-8 mx-auto mb-2" />
              <div className="font-semibold">View Analytics</div>
            </button>
            <button className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-300 text-center transform hover:scale-105 shadow hover:shadow-xl">
              <Settings className="h-8 w-8 mx-auto mb-2" />
              <div className="font-semibold">Settings</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default page;
