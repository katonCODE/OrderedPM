// client/src/components/SkeletonLoader.jsx
import React from 'react';

export function SkeletonBox({ className = '', width, height }) {
  return (
    <div
      className={`bg-white/5 rounded animate-pulse ${className}`}
      style={{
        width: width || '100%',
        height: height || '1rem',
      }}
    />
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="dashboard-sketch-card dashboard-panel relative p-6">
      <div className="flex justify-between items-start gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <SkeletonBox height="1.5rem" width="60%" className="mb-2" />
          <SkeletonBox height="1rem" width="80%" className="mb-1" />
          <SkeletonBox height="1rem" width="50%" />
        </div>
        <div className="flex gap-2">
          <SkeletonBox width="2rem" height="2rem" className="rounded-lg" />
          <SkeletonBox width="2rem" height="2rem" className="rounded-lg" />
          <SkeletonBox width="2rem" height="2rem" className="rounded-lg" />
        </div>
      </div>
      <div className="flex gap-4 mt-4">
        <SkeletonBox height="1rem" width="4rem" />
        <SkeletonBox height="1rem" width="4rem" />
        <SkeletonBox height="1rem" width="4rem" />
      </div>
    </div>
  );
}

export function TaskCardSkeleton() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-3">
      <SkeletonBox height="1.25rem" width="70%" className="mb-2" />
      <SkeletonBox height="1rem" width="90%" className="mb-3" />
      <div className="flex gap-2">
        <SkeletonBox height="1.5rem" width="5rem" className="rounded" />
        <SkeletonBox height="1.5rem" width="5rem" className="rounded" />
      </div>
    </div>
  );
}

export function KanbanColumnSkeleton() {
  return (
    <div className="flex-1 min-w-[280px]">
      <div className="mb-4">
        <SkeletonBox height="1.5rem" width="40%" />
      </div>
      <div className="space-y-3">
        <TaskCardSkeleton />
        <TaskCardSkeleton />
        <TaskCardSkeleton />
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="dashboard-sketch-card dashboard-stat-card">
          <SkeletonBox height="1rem" width="60%" className="mb-2" />
          <SkeletonBox height="2rem" width="40%" />
        </div>
      ))}
    </div>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <SkeletonBox height="2rem" width="200px" />
        <SkeletonBox height="3rem" width="120px" className="rounded-lg" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        <aside className="space-y-6">
          <SkeletonBox height="300px" className="rounded-lg" />
          <SkeletonBox height="200px" className="rounded-lg" />
        </aside>
        <div className="space-y-4">
          <div className="flex gap-4">
            <KanbanColumnSkeleton />
            <KanbanColumnSkeleton />
            <KanbanColumnSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

export default {
  SkeletonBox,
  ProjectCardSkeleton,
  TaskCardSkeleton,
  KanbanColumnSkeleton,
  StatsSkeleton,
  ProjectDetailSkeleton,
};
