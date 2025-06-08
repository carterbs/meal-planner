import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { format, addDays, startOfWeek } from 'date-fns';

const daysOfWeek = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

export const Timeline: React.FC = () => {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
      {daysOfWeek.map((day, index) => (
        <Paper key={day} sx={{ p: 2 }}>
          <Typography variant="h6">
            {day} ({format(addDays(start, index), 'MMM d')})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Timeline placeholder for {day}
          </Typography>
        </Paper>
      ))}
    </Box>
  );
};

export default Timeline;
