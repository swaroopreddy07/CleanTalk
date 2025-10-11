/**
 * Follow Utility Functions
 * 
 * This module provides utility functions for handling follow button states,
 * styling, and text across the application to reduce code duplication.
 * 
 * @author SocialConnect Team
 * @version 1.0.0
 */

/**
 * Get follow button text based on follow status
 * @param {string|null} followStatus - Current follow status ('accepted', 'pending', null)
 * @returns {string} Button text
 */
export const getFollowButtonText = (followStatus) => {
    switch (followStatus) {
      case 'pending':
        return 'Requested';
      case 'accepted':
        return 'Following';
      default:
        return 'Follow';
    }
  };
  
  /**
   * Get follow button styling based on follow status
   * @param {string|null} followStatus - Current follow status ('accepted', 'pending', null)
   * @returns {Object} Button styling object
   */
  export const getFollowButtonStyles = (followStatus) => {
    const baseStyles = {
      textTransform: 'none',
      fontWeight: 600,
      minWidth: 100,
    };
  
    switch (followStatus) {
      case 'pending':
        return {
          ...baseStyles,
          background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
          color: 'white',
          border: 'none',
          '&:hover': {
            background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
          },
        };
      case 'accepted':
        return {
          ...baseStyles,
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)',
          color: 'primary.main',
          border: '2px solid #6366f1',
          '&:hover': {
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
          },
        };
      default:
        return {
          ...baseStyles,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          color: 'white',
          border: 'none',
          '&:hover': {
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
          },
        };
    }
  };
  
  /**
   * Determine the next follow action based on current status
   * @param {string|null} currentStatus - Current follow status
   * @returns {string} Next action ('follow', 'unfollow', 'cancel')
   */
  export const getNextFollowAction = (currentStatus) => {
    switch (currentStatus) {
      case 'accepted':
        return 'unfollow';
      case 'pending':
        return 'cancel';
      default:
        return 'follow';
    }
  };
  
  /**
   * Get button variant based on follow status
   * @param {string|null} followStatus - Current follow status
   * @returns {string} Material-UI button variant
   */
  export const getFollowButtonVariant = (followStatus) => {
    return 'contained';
  };
  
  /**
   * Get button color based on follow status
   * @param {string|null} followStatus - Current follow status
   * @returns {string} Material-UI button color
   */
  export const getFollowButtonColor = (followStatus) => {
    switch (followStatus) {
      case 'pending':
        return 'warning';
      case 'accepted':
        return 'primary';
      default:
        return 'primary';
    }
  };
  
  /**
   * Check if follow button should be disabled
   * @param {string|null} followStatus - Current follow status
   * @param {boolean} isLoading - Loading state
   * @returns {boolean} Whether button should be disabled
   */
  export const isFollowButtonDisabled = (followStatus, isLoading = false) => {
    return isLoading;
  };
  
  /**
   * Get follow button size
   * @param {string} size - Size preference ('small', 'medium', 'large')
   * @returns {string} Button size
   */
  export const getFollowButtonSize = (size = 'small') => {
    return size;
  };