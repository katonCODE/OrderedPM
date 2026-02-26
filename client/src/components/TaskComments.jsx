// client/src/components/TaskComments.jsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksAPI } from '../services/api';
import { authService } from '../services/auth';
import MentionAutocomplete from './MentionAutocomplete';

function TaskComments({ taskId, canManageTasks = true }) {
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editContent, setEditContent] = useState('');

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

  const { data: commentsData, isLoading } = useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: () => tasksAPI.getComments(taskId),
    enabled: !!taskId,
    refetchOnWindowFocus: false,
  });

  const comments = commentsData?.data || [];
  const topLevelComments = comments.filter(c => !c.parent_comment_id);
  const repliesByParent = comments.reduce((acc, comment) => {
    if (comment.parent_comment_id) {
      if (!acc[comment.parent_comment_id]) {
        acc[comment.parent_comment_id] = [];
      }
      acc[comment.parent_comment_id].push(comment);
    }
    return acc;
  }, {});

  const createCommentMutation = useMutation({
    mutationFn: ({ content, parent_comment_id }) => tasksAPI.createComment(taskId, { content, parent_comment_id }),
    onSuccess: () => {
      setNewComment('');
      setReplyingTo(null);
      setReplyContent('');
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-activities', taskId] });
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: ({ commentId, content }) => tasksAPI.updateComment(taskId, commentId, { content }),
    onSuccess: () => {
      setEditingCommentId(null);
      setEditContent('');
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId) => tasksAPI.deleteComment(taskId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-activities', taskId] });
    },
  });

  const handleSubmitComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    createCommentMutation.mutate({ content: newComment.trim(), parent_comment_id: null });
  };

  const handleSubmitReply = (e, parentId) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    createCommentMutation.mutate({ content: replyContent.trim(), parent_comment_id: parentId });
  };

  const handleStartEdit = (comment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
  };

  const handleSaveEdit = (commentId) => {
    if (!editContent.trim()) return;
    updateCommentMutation.mutate({ commentId, content: editContent.trim() });
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditContent('');
  };

  const getUserName = (comment) => comment.user_full_name || comment.user_username || 'Unknown';
  const getUserInitials = (comment) => {
    const name = getUserName(comment);
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const highlightMentions = (content) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, index) => {
      if (part.match(/^@\w+$/)) {
        return (
          <span key={index} className="text-blue-400 font-medium">
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const CommentItem = ({ comment, isReply = false }) => {
    const isEditing = editingCommentId === comment.id;
    const replies = repliesByParent[comment.id] || [];
    const mentions = comment.mentions || [];

    return (
      <div className={`${isReply ? 'ml-8 mt-2' : ''}`}>
        <div className="flex gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
          {comment.user_avatar_url ? (
            <img
              src={comment.user_avatar_url}
              alt={getUserName(comment)}
              className="w-8 h-8 rounded-full object-cover border border-white/20 flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 text-xs text-gray-300 flex items-center justify-center font-semibold flex-shrink-0">
              {getUserInitials(comment)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-medium text-[#e0e0e0]">{getUserName(comment)}</span>
              <span className="text-xs text-gray-500">{formatTimeAgo(comment.created_at)}</span>
              {comment.updated_at !== comment.created_at && (
                <span className="text-xs text-gray-500">(edited)</span>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <MentionAutocomplete
                  taskId={taskId}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Edit your comment... (type @ to mention someone)"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(comment.id)}
                    disabled={updateCommentMutation.isPending || !editContent.trim()}
                    className="px-3 py-1 text-xs bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-300 hover:bg-blue-500/30 transition-all disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1 text-xs bg-white/5 border border-white/10 rounded-lg text-gray-300 hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-sm text-[#e0e0e0] whitespace-pre-wrap mb-2">
                  {highlightMentions(comment.content)}
                </div>
                {mentions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {mentions.map((mention) => (
                      <span
                        key={mention.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-300"
                        title={mention.mentioned_full_name || mention.mentioned_username}
                      >
                        @{mention.mentioned_username}
                      </span>
                    ))}
                  </div>
                )}
                {canManageTasks && (
                  <div className="flex gap-2">
                    {!isReply && (
                      <button
                        onClick={() => {
                          setReplyingTo(replyingTo === comment.id ? null : comment.id);
                          setReplyContent('');
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-all"
                      >
                        {replyingTo === comment.id ? 'Cancel' : 'Reply'}
                      </button>
                    )}
                    {comment.user_id === currentUserId && (
                      <>
                        <button
                          onClick={() => handleStartEdit(comment)}
                          className="text-xs text-gray-400 hover:text-gray-300 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this comment?')) {
                              deleteCommentMutation.mutate(comment.id);
                            }
                          }}
                          disabled={deleteCommentMutation.isPending}
                          className="text-xs text-red-400 hover:text-red-300 transition-all disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {replyingTo === comment.id && (
          <form onSubmit={(e) => handleSubmitReply(e, comment.id)} className="ml-8 mt-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <MentionAutocomplete
                  taskId={taskId}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply... (type @ to mention someone)"
                  rows={2}
                />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={createCommentMutation.isPending || !replyContent.trim()}
                  className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm text-blue-300 hover:bg-blue-500/30 transition-all disabled:opacity-50"
                >
                  Reply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyContent('');
                  }}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}
        {replies.map((reply) => (
          <CommentItem key={reply.id} comment={reply} isReply={true} />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-400">Comments</h3>
        <p className="text-xs text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400">Comments</h3>
      {canManageTasks && (
        <form onSubmit={handleSubmitComment} className="space-y-2">
          <MentionAutocomplete
            taskId={taskId}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment... (type @ to mention someone)"
            rows={3}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={createCommentMutation.isPending || !newComment.trim()}
              className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm text-blue-300 hover:bg-blue-500/30 transition-all disabled:opacity-50"
            >
              {createCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>
      )}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {topLevelComments.length === 0 ? (
          <p className="text-xs text-gray-500">No comments yet</p>
        ) : (
          topLevelComments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </div>
  );
}

export default TaskComments;
