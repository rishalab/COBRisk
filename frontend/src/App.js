import React, { useState } from 'react';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  const [analysisData, setAnalysisData] = useState(null);
  const [page, setPage] = useState('landing'); // 'landing' | 'dashboard'

  const handleAnalysis = (data) => {
    setAnalysisData(data);
    setPage('dashboard');
  };

  const handleReset = () => {
    setAnalysisData(null);
    setPage('landing');
  };

  return page === 'landing'
    ? <LandingPage onAnalysis={handleAnalysis} />
    : <DashboardPage data={analysisData} onReset={handleReset} />;
}
