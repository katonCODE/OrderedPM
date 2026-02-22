import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectsAPI } from '../services/api';

function ShareLinkRedeem() {
  const navigate = useNavigate();
  const { token } = useParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const redeem = async () => {
      if (!token) {
        setError('Share token is missing');
        return;
      }
      try {
        const result = await projectsAPI.redeemShareLink(token);
        if (result?.project_id) {
          navigate(`/project/${result.project_id}`, { replace: true });
          return;
        }
        navigate('/dashboard', { replace: true });
      } catch (err) {
        setError(err?.message || 'Failed to redeem share link');
      }
    };
    redeem();
  }, [token, navigate]);

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-[#e0e0e0] flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-xl border border-white/10 bg-white/5 p-6">
        {error ? (
          <>
            <h2 className="text-lg font-semibold mb-2">Could not join project</h2>
            <p className="text-sm text-red-400 mb-4">{error}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-white/10 border border-white/10 rounded-lg hover:bg-white/20 transition-all"
            >
              Back to Dashboard
            </button>
          </>
        ) : (
          <p className="text-sm text-gray-300">Joining shared project...</p>
        )}
      </div>
    </div>
  );
}

export default ShareLinkRedeem;

