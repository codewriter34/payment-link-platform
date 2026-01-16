'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import ProductForm from '@/components/dashboard/ProductForm';

export default function CreateProductPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8">
        <ProductForm />
      </div>
    </AuthGuard>
  );
}
