
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Login from "./Login";
import Dashboard from "./Dashboard";
import PublicBar from "./PublicBar";
import { useAuthStore } from "@/store/authStore";
import PublicMap from "./PublicMap";
import PublicMapMatcha from "./PublicMapMatcha";
import AdminBars from "./AdminBars";
import FiddlesDirections from "./Directions";
import Callback from "./callback"; 
import BarTender from "./BarTender";
import PublicTickets from "./PublicTickets";

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
          element={<Login />} 
        />
        <Route 
          path="/dashboard" 
          element={token ? <Dashboard /> : <Navigate to="/login" />} 
        />
        <Route path="/events/:eventId/tickets" element={<PublicTickets />} />
        <Route path="/bartender/:pos_id" element={<BarTender />} />
        <Route path="/bar/:barId" element={<PublicBar />} />
        <Route path="/map" element={<PublicMap />} />
        <Route path="/queen" element={<PublicMapMatcha />} />
        <Route path="/matcha" element={<PublicMapMatcha />} />
        <Route path="/directions" element={<FiddlesDirections />} />

        <Route path="/admin/bars" element={<AdminBars />} />
        <Route path="*" element={<Navigate to="/directions" />} />

      </Routes>
    </BrowserRouter>
  );
};

export default Index;
