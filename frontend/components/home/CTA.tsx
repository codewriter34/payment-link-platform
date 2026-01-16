import Link from 'next/link';

export default function CTA() {
  return (
    <section className="py-24 bg-blue-600">
      <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Ready to Start Accepting Payments?
        </h2>
        <p className="text-xl text-blue-100 mb-8">
          Join thousands of merchants already using PayMo for their Mobile Money payments.
        </p>
        <Link
          href="/signup"
          className="bg-white text-blue-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors"
        >
          Create Your Account
        </Link>
      </div>
    </section>
  );
}
