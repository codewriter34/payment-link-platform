interface StatsCard {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isCurrency?: boolean;
}

interface StatsCardsProps {
  stats: StatsCard[];
}

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900">
                {stat.isCurrency && typeof stat.value === 'number'
                  ? `${stat.value.toLocaleString()} FCFA`
                  : stat.value
                }
              </p>
              {stat.trend && (
                <div className={`flex items-center mt-2 text-sm ${
                  stat.trend.isPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  <svg className={`w-4 h-4 mr-1 ${
                    stat.trend.isPositive ? 'rotate-0' : 'rotate-180'
                  }`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                  </svg>
                  {Math.abs(stat.trend.value)}%
                </div>
              )}
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              {stat.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
