// client/src/components/Pagination.jsx
import React from 'react';
import './Pagination.css';

function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  itemsPerPage,
  totalItems,
  hasMore = false,
  isLoading = false 
}) {
  // Hide pagination if we have totalPages and it's 1 or less
  // Or if we don't have totalPages and there's no more pages
  if (totalPages !== null && totalPages <= 1) return null;
  if (totalPages === null && !hasMore && currentPage === 1) return null;

  const handlePrevious = () => {
    if (currentPage > 1 && !isLoading) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    const canGoNext = totalPages !== null 
      ? currentPage < totalPages 
      : hasMore;
    if (canGoNext && !isLoading) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageClick = (page) => {
    if (page !== currentPage && !isLoading) {
      onPageChange(page);
    }
  };

  const getPageNumbers = () => {
    // If we don't have totalPages, don't show page numbers (only Previous/Next)
    if (totalPages === null) {
      return [];
    }
    
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = totalItems !== null 
    ? Math.min(currentPage * itemsPerPage, totalItems)
    : currentPage * itemsPerPage;

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        {totalItems !== null ? (
          <>Showing {startItem}-{endItem} of {totalItems}</>
        ) : (
          <>Showing {startItem}-{endItem}{hasMore ? '+' : ''}</>
        )}
      </div>
      
      <div className="pagination-controls">
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1 || isLoading}
          className="pagination-btn"
          aria-label="Previous page"
        >
          Previous
        </button>
        
        {getPageNumbers().length > 0 && (
          <div className="pagination-pages">
            {getPageNumbers().map((page, index) => {
              if (page === 'ellipsis') {
                return (
                  <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                    ...
                  </span>
                );
              }
              
              return (
                <button
                  key={page}
                  onClick={() => handlePageClick(page)}
                  disabled={isLoading}
                  className={`pagination-page ${currentPage === page ? 'active' : ''}`}
                  aria-label={`Page ${page}`}
                  aria-current={currentPage === page ? 'page' : undefined}
                >
                  {page}
                </button>
              );
            })}
          </div>
        )}
        
        <button
          onClick={handleNext}
          disabled={(totalPages !== null && currentPage === totalPages) || (!hasMore && totalPages === null) || isLoading}
          className="pagination-btn"
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default Pagination;

