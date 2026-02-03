// client/src/components/Profile.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfileByUsername } from '../services/profile';
import { authService } from '../services/auth';
import EditProfile from './EditProfile';
import './Profile.css';

function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => getProfileByUsername(username),
    enabled: !!username,
  });

  useEffect(() => {
    const checkCurrentUser = async () => {
      try {
        const session = await authService.getSession();
        if (session && session.user) {
          setCurrentUserId(session.user.id);
        }
      } catch (error) {
        console.error('Error checking current user:', error);
      }
    };
    checkCurrentUser();
  }, []);

  const isOwner = currentUserId && profile && profile.id === currentUserId;

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-animation">
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
        </div>
        <p className="loading-text">Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error.message || 'Failed to load profile'}</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="error-container">
        <p>Profile not found</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <button onClick={() => navigate('/dashboard')} className="btn-back">
          ← Back to Dashboard
        </button>
      </div>

      <div className="profile-content">
        <div className="profile-avatar-section">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name || profile.username}
              className="profile-avatar-large"
            />
          ) : (
            <div className="profile-avatar-placeholder-large">
              <span>👤</span>
            </div>
          )}
        </div>

        <div className="profile-info">
          <h1 className="profile-name">
            {profile.full_name || profile.username}
          </h1>
          <p className="profile-username">@{profile.username}</p>

          {profile.bio && (
            <div className="profile-bio">
              <p>{profile.bio}</p>
            </div>
          )}

          {isOwner && (
            <button
              onClick={() => setShowEditModal(true)}
              className="btn-primary btn-edit-profile"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {showEditModal && (
        <EditProfile
          profile={profile}
          onClose={() => setShowEditModal(false)}
          onUpdate={() => {
            setShowEditModal(false);
            // Invalidate and refetch profile data
            queryClient.invalidateQueries({ queryKey: ['profile', username] });
            queryClient.invalidateQueries({ queryKey: ['myProfile'] });
          }}
        />
      )}
    </div>
  );
}

export default Profile;

