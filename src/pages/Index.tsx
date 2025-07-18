
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Login from "./Login";
import Dashboard from "./Dashboard";
import PublicBar from "./PublicBar";
import { useAuthStore } from "@/store/authStore";
import PublicMap from "./PublicMap";
import Callback from "./callback"; 
import BarTender from "./BarTender";

const Index = () => {
  const { token, checkAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    setIsLoading(false);
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/callback" element={<Callback />} />
        <Route 
          path="/login" 
          element={token ? <Navigate to="/dashboard" /> : <Login />} 
        />
        <Route 
          path="/dashboard" 
          element={token ? <Dashboard /> : <Navigate to="/login" />} 
        />
        <Route path="/bartender/:pos_id" element={<BarTender />} />
        <Route path="/bar/:barId" element={<PublicBar />} />
        <Route 
          path="/" 
          element={token ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} 
        />
        <Route path="/map" element={<PublicMap />} />

      </Routes>
    </BrowserRouter>
  );
};

export default Index;
