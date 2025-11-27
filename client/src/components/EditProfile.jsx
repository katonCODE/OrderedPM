// client/src/components/EditProfile.jsx
import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateProfile, getMyProfile } from '../services/profile';
import { authService } from '../services/auth';
import AvatarUpload from './AvatarUpload';
import './EditProfile.css';

function EditProfile({ profile, onClose, onUpdate }) {
  const [username, setUsername] = useState(profile.username || '');
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || null);
  const [userId, setUserId] = useState(null);
  const [errors, setErrors] = useState({});
  
  const queryClient = useQueryClient();

  useEffect(() => {
    const getUserId = async () => {
      try {
        const session = await authService.getSession();
        if (session && session.user) {
          setUserId(session.user.id);
        }
      } catch (error) {
        console.error('Error getting user ID:', error);
      }
    };
    getUserId();
  }, []);

  const updateMutation = useMutation({
    mutationFn: (profileData) => updateProfile(profileData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      if (onUpdate) {
        onUpdate();
      }
    },
    onError: (error) => {
      const errorMessage = error.message || 'Failed to update profile';
      if (errorMessage.includes('Username already taken')) {
        setErrors({ username: 'Username already taken' });
      } else if (errorMessage.includes('150 words')) {
        setErrors({ bio: 'Bio must be 150 words or less' });
      } else {
        setErrors({ general: errorMessage });
      }
    },
  });

  const countWords = (text) => {
    if (!text || text.trim() === '') return 0;
    return text.trim().split(/\s+/).length;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors = {};
    if (!username.trim()) {
      newErrors.username = 'Username is required';
    }
    
    const wordCount = countWords(bio);
    if (wordCount > 150) {
      newErrors.bio = `Bio must be 150 words or less (currently ${wordCount} words)`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    updateMutation.mutate({
      username: username.trim(),
      full_name: fullName.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl,
    });
  };

  const handleAvatarUpload = (url) => {
    setAvatarUrl(url);
  };

  return (
    <div className="edit-profile-modal-overlay" onClick={onClose}>
      <div className="edit-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-profile-header">
          <h2>Edit Profile</h2>
          <button onClick={onClose} className="btn-close">×</button>
        </div>

        <form onSubmit={handleSubmit} className="edit-profile-form">
          {errors.general && (
            <div className="error-banner">{errors.general}</div>
          )}

          <div className="form-section">
            <AvatarUpload
              currentAvatarUrl={avatarUrl}
              onUploadComplete={handleAvatarUpload}
              userId={userId}
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={errors.username ? 'input-error' : ''}
              required
            />
            {errors.username && (
              <span className="error-text">{errors.username}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="bio">
              Bio ({countWords(bio)}/150 words)
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className={errors.bio ? 'input-error' : ''}
              placeholder="Tell us about yourself..."
            />
            {errors.bio && (
              <span className="error-text">{errors.bio}</span>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={updateMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProfile;

