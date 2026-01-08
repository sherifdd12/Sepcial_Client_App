import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { CaseData } from '../types';

interface AnalyticsProps {
  cases: CaseData[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const Analytics: React.FC<AnalyticsProps> = ({ cases }) => {
  
  // Process data for "Cases by Entity"
  const entityCount = cases.reduce((acc, curr) => {
    const ent = curr.entity || "غير محدد";
    acc[ent] = (acc[ent] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const entityData = Object.keys(entityCount).map(key => ({
    name: key,
    value: entityCount[key]
  }));

  // Process data for "Cases by Type"
  const typeCount = cases.reduce((acc, curr) => {
    const t = curr.caseType || "غير محدد";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typeData = Object.keys(typeCount).map(key => ({
    name: key,
    count: typeCount[key]
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">توزيع القضايا حسب الجهة</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={entityData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {entityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">أنواع القضايا</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={typeData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="عدد القضايا" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
