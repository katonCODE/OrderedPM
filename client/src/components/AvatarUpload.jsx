// client/src/components/AvatarUpload.jsx
import React, { useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import './AvatarUpload.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

function AvatarUpload({ currentAvatarUrl, onUploadComplete, userId }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentAvatarUrl || null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload to Supabase
    await uploadAvatar(file);
  };

  const uploadAvatar = async (file) => {
    if (!supabase || !userId) {
      alert('Upload service not available');
      return;
    }

    setUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Callback with the public URL
      if (onUploadComplete) {
        onUploadComplete(publicUrl);
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Failed to upload avatar. Please try again.');
      // Reset preview on error
      setPreview(currentAvatarUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="avatar-upload">
      <div className="avatar-preview" onClick={handleClick}>
        {preview ? (
          <img src={preview} alt="Avatar preview" />
        ) : (
          <div className="avatar-placeholder">
            <span>📷</span>
          </div>
        )}
        {uploading && (
          <div className="avatar-upload-overlay">
            <div className="avatar-upload-spinner">⏳</div>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={uploading}
        className="btn-avatar-upload"
      >
        {uploading ? 'Uploading...' : 'Change Avatar'}
      </button>
    </div>
  );
}

export default AvatarUpload;

