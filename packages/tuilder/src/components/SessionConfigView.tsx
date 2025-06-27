import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { StudyConfig } from '../types/study.js';
import LoadingSpinner from './Spinner.js';
import { getDataLayer, CourseLookup } from '@vue-skuilder/db';
import { useInput } from 'ink';

interface SessionConfigViewProps {
  onConfigComplete: (config: StudyConfig) => void;
  onBack: () => void;
}

interface Course {
  id: string;
  name: string;
  reviewCount?: number;
}

const SessionConfigView = ({ onConfigComplete, onBack }: SessionConfigViewProps) => {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [step, setStep] = useState<'courses' | 'duration'>('courses');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const dataLayer = getDataLayer();
      const userDB = await dataLayer.getUserDB();
      
      // Get user's registered courses
      const registrationsDoc = await userDB.getCourseRegistrationsDoc();
      
      if (registrationsDoc.courses.length === 0) {
        // Fallback to default course if no registrations
        setCourses([{ id: 'default', name: 'Default Course' }]);
        setSelectedCourseIds(['default']);
      } else {
        const activeCourses = registrationsDoc.courses
          .filter((reg: any) => reg.status === 'active' || !reg.status);
        
        if (activeCourses.length === 0) {
          // No active courses, fallback to default
          setCourses([{ id: 'default', name: 'Default Course' }]);
          setSelectedCourseIds(['default']);
        } else {
          // Get course names from the course lookup database
          const courseList = await Promise.all(
            activeCourses.map(async (reg: any) => {
              try {
                // Try to get the course name from the lookup DB
                const allCourses = await CourseLookup.allCourses();
                const courseDoc = allCourses.find(doc => doc._id === reg.courseID);
                
                return {
                  id: reg.courseID,
                  name: courseDoc?.name || reg.courseID, // Fall back to ID if name not found
                  reviewCount: 0 // TODO: get actual review count
                };
              } catch (err) {
                // If lookup fails, use the courseID as name
                return {
                  id: reg.courseID,
                  name: reg.courseID,
                  reviewCount: 0
                };
              }
            })
          );
          
          setCourses(courseList);
          // Default to all courses selected
          setSelectedCourseIds(courseList.map((c: any) => c.id));
        }
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to load courses:', err);
      // Fallback to default course
      setCourses([{ id: 'default', name: 'Default Course' }]);
      setSelectedCourseIds(['default']);
      setLoading(false);
    }
  };

  const durationOptions = [
    { label: '1 minute', value: 60 },
    { label: '2 minutes', value: 120 },
    { label: '3 minutes', value: 180 },
    { label: '5 minutes', value: 300 },
    { label: '8 minutes', value: 480 },
    { label: '12 minutes', value: 720 }
  ];

  // Handle input for course selection with spacebar support
  useInput((input, key) => {
    if (step === 'courses') {
      const totalItems = courses.length + 2; // courses + continue + back

      if (key.upArrow) {
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : totalItems - 1));
      } else if (key.downArrow) {
        setHighlightedIndex(prev => (prev < totalItems - 1 ? prev + 1 : 0));
      } else if (input === ' ') {
        // Spacebar to toggle course selection
        if (highlightedIndex < courses.length) {
          const courseId = courses[highlightedIndex].id;
          if (selectedCourseIds.includes(courseId)) {
            setSelectedCourseIds(prev => prev.filter(id => id !== courseId));
          } else {
            setSelectedCourseIds(prev => [...prev, courseId]);
          }
        }
      } else if (key.return) {
        // Enter key to select action
        if (highlightedIndex === courses.length) {
          // Continue button
          if (selectedCourseIds.length === 0) {
            setError('Please select at least one course');
            return;
          }
          setError('');
          setStep('duration');
          setHighlightedIndex(0);
        } else if (highlightedIndex === courses.length + 1) {
          // Back button
          onBack();
        } else {
          // Course item - toggle selection
          const courseId = courses[highlightedIndex].id;
          if (selectedCourseIds.includes(courseId)) {
            setSelectedCourseIds(prev => prev.filter(id => id !== courseId));
          } else {
            setSelectedCourseIds(prev => [...prev, courseId]);
          }
        }
      }
    }
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text color="blue">Press Ctrl+C to exit</Text>
      </Box>
    );
  }

  if (step === 'courses') {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">Session Configuration</Text>
        <Text>Select courses to study (↑↓ to navigate, Space to toggle, Enter to confirm):</Text>
        <Box marginTop={1} flexDirection="column">
          {courses.map((course, index) => {
            const isSelected = selectedCourseIds.includes(course.id);
            const isHighlighted = highlightedIndex === index;
            const prefix = isHighlighted ? '>' : ' ';
            const checkbox = isSelected ? '✓' : ' ';
            const color = isHighlighted ? 'cyan' : isSelected ? 'green' : 'white';
            
            return (
              <Text key={course.id} color={color}>
                {prefix} [{checkbox}] {course.name}
                {course.reviewCount ? ` (${course.reviewCount} reviews)` : ''}
              </Text>
            );
          })}
          
          <Text color="gray">────────────────</Text>
          
          <Text color={highlightedIndex === courses.length ? 'cyan' : 'white'}>
            {highlightedIndex === courses.length ? '>' : ' '} ▶ Continue to Duration
          </Text>
          
          <Text color={highlightedIndex === courses.length + 1 ? 'cyan' : 'white'}>
            {highlightedIndex === courses.length + 1 ? '>' : ' '} ← Back to Login
          </Text>
        </Box>
        
        {error && (
          <Box marginTop={1}>
            <Text color="red">{error}</Text>
          </Box>
        )}
        
        {selectedCourseIds.length > 0 && (
          <Box marginTop={1}>
            <Text color="green">
              Selected: {courses
                .filter(c => selectedCourseIds.includes(c.id))
                .map(c => c.name)
                .join(', ')}
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  if (step === 'duration') {
    const items = [
      ...durationOptions.map(option => ({
        label: option.label,
        value: option.value.toString()
      })),
      { label: '────────────────', value: 'separator', disabled: true },
      { label: '← Back to Course Selection', value: 'back' }
    ];

    return (
      <Box flexDirection="column">
        <Text bold color="cyan">Session Duration</Text>
        <Text>How long would you like to study?</Text>
        <Box marginTop={1}>
          <SelectInput
            items={items}
            onSelect={(item) => {
              if (item.value === 'back') {
                setStep('courses');
              } else if (item.value !== 'separator') {
                const durationSeconds = parseInt(item.value);
                const config: StudyConfig = {
                  courseIds: selectedCourseIds,
                  durationSeconds,
                  maxNewCards: 10 // Fixed for MVP
                };
                onConfigComplete(config);
              }
            }}
          />
        </Box>
        <Box marginTop={1}>
          <Text color="green">Courses: {selectedCourseIds.join(', ')}</Text>
        </Box>
      </Box>
    );
  }

  return null;
};

export default SessionConfigView;