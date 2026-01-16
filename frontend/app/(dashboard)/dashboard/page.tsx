'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> { }
  }
}
import AuthGuard from '@/components/auth/AuthGuard';
import Navbar from '@/components/layout/Navbar';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import StatsCards from '@/components/dashboard/StatsCards';
import ProductGrid from '@/components/dashboard/ProductGrid';

interface StatItem {
  title: string;
  value: number;
  icon: React.ReactElement;
  isCurrency?: boolean;
  trend?: { value: number; isPositive: boolean };
}

function DashboardContent() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statsData, setStatsData] = useState<StatItem[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for success messages from query parameters
    const success = searchParams.get('success');
    if (success === 'product_created') {
      setSuccessMessage('Product created successfully! 🎉');
      // Clear the URL parameter after showing the message
      window.history.replaceState({}, '', '/dashboard');
      // Auto-hide the message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } else if (success === 'product_updated') {
      setSuccessMessage('Product updated successfully! 🎉');
      // Clear the URL parameter after showing the message
      window.history.replaceState({}, '', '/dashboard');
      // Auto-hide the message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      console.log('Fetching stats with token:', token ? 'Token present' : 'No token');

      if (!token) {
        console.log('No auth token, skipping stats fetch');
        setIsLoadingStats(false);
        return;
      }

      console.log('Making API call to fetch stats...');
      const response = await fetch('http://localhost:3002/api/v1/products/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('Stats API Response status:', response.status);

      if (response.ok) {
        const stats = await response.json();
        console.log('Stats data received:', stats);

        setStatsData([
          {
            title: 'Total Products',
            value: stats.totalProducts || 0,
            icon: (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            ),
            trend: { value: 12, isPositive: true }
          },
          {
            title: 'Total Revenue',
            value: stats.totalRevenue || 0,
            icon: (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            isCurrency: true,
            trend: { value: 8, isPositive: true }
          },
          {
            title: 'Payments Today',
            value: 0,
            icon: (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )
          },
          {
            title: 'Active Links',
            value: 0,
            icon: (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            ),
            trend: { value: 5, isPositive: false }
          }
        ]);
      } else {
        const errorText = await response.text();
        console.error('Stats API error:', response.status, errorText);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Fallback stats data while loading
  const fallbackStatsData: StatItem[] = [
    {
      title: 'Total Products',
      value: 0,
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      trend: { value: 0, isPositive: true }
    },
    {
      title: 'Total Revenue',
      value: 0,
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      isCurrency: true,
      trend: { value: 0, isPositive: true }
    },
    {
      title: 'Payments Today',
      value: 0,
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      title: 'Active Links',
      value: 0,
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      trend: { value: 0, isPositive: false }
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Success Message */}
      {successMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium text-green-800">{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="ml-auto pl-3"
              >
                <svg className="w-5 h-5 text-green-400 hover:text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header */}
        <div className="mb-8">
          <DashboardHeader />
        </div>

        {/* Stats Cards */}
        <StatsCards stats={isLoadingStats ? fallbackStatsData : statsData} />

        {/* Product Management Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Product Management</h2>
              <p className="text-gray-600 mt-1">
                Manage your products, create payment links, and track performance
              </p>
            </div>
            <button
              onClick={() => window.location.href = '/dashboard/create-product'}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New Product
            </button>
          </div>
        </div>

        {/* Products Section */}
        <ProductGrid />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}