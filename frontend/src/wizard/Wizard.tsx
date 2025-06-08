import React, { useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, Typography, LinearProgress, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';

const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const mealTypes = ['Breakfast','Lunch','Dinner'];

interface Plan {
  [day: string]: {
    [meal: string]: string | null;
  };
}

const suggestions: Record<string, string[]> = {
  Breakfast: ['Pancakes','Oatmeal','Eggs'],
  Lunch: ['Sandwich','Salad','Soup'],
  Dinner: ['Pasta','Chicken','Steak']
};

export default function Wizard() {
  const [step, setStep] = useState<'start' | number | 'summary'>('start');
  const [selectedMeals, setSelectedMeals] = useState<{[meal: string]: boolean}>({ Breakfast: true, Lunch: true, Dinner: true });
  const [plan, setPlan] = useState<Plan>({});
  const [suggestIdx, setSuggestIdx] = useState<Record<string, number>>({ Breakfast:0, Lunch:0, Dinner:0 });

  const startPlanning = () => setStep(0);

  const toggleMealType = (meal: string) => {
    setSelectedMeals(prev => ({...prev, [meal]: !prev[meal]}));
  };

  const acceptMeal = (day: string, meal: string) => {
    setPlan(prev => ({
      ...prev,
      [day]: { ...(prev[day] || {}), [meal]: suggestions[meal][suggestIdx[meal]] }
    }));
  };

  const shuffleMeal = (meal: string) => {
    setSuggestIdx(prev => ({ ...prev, [meal]: (prev[meal] + 1) % suggestions[meal].length }));
  };

  const currentDay = typeof step === 'number' ? days[step] : '';

  const isAccepted = (meal: string) => plan[currentDay]?.[meal];

  const allAccepted = () => {
    if (typeof step !== 'number') return false;
    for (const meal of mealTypes) {
      if (!selectedMeals[meal]) continue;
      if (!isAccepted(meal)) return false;
    }
    return true;
  };

  const next = () => {
    if (typeof step !== 'number') return;
    if (step === days.length - 1) {
      setStep('summary');
    } else {
      setStep(step + 1);
    }
  };

  const prev = () => {
    if (typeof step === 'number' && step > 0) setStep(step - 1);
  };

  if (step === 'start') {
    return (
      <Box sx={{maxWidth: 640, mx: 'auto', p:3}}>
        <Typography variant="h4" gutterBottom>Start Planning</Typography>
        <Box sx={{display:'flex', flexDirection:'column', mb:2}}>
          {mealTypes.map(meal => (
            <FormControlLabel key={meal}
              control={<Checkbox checked={selectedMeals[meal]} onChange={() => toggleMealType(meal)} />}
              label={meal}
            />
          ))}
        </Box>
        <Button variant="contained" onClick={startPlanning}>Begin</Button>
      </Box>
    );
  }

  if (step === 'summary') {
    return (
      <Box sx={{maxWidth:640, mx:'auto', p:3}}>
        <Typography variant="h4" gutterBottom>Summary</Typography>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Day</TableCell>
              {mealTypes.map(m => <TableCell key={m}>{m}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {days.map(d => (
              <TableRow key={d}>
                <TableCell>{d}</TableCell>
                {mealTypes.map(m => (
                  <TableCell key={m}>{plan[d]?.[m] || 'Skipped'}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button variant="contained" sx={{mt:2}} onClick={() => setStep(0)}>Edit</Button>
      </Box>
    );
  }

  return (
    <Box sx={{maxWidth:640, mx:'auto', p:3}}>
      <LinearProgress variant="determinate" value={((step+1)/7)*100} />
      <Typography variant="h5" gutterBottom sx={{mt:2}}>Plan {currentDay}</Typography>
      {mealTypes.map(meal => (
        <Box key={meal} sx={{mb:2}}>
          <FormControlLabel
            control={<Checkbox checked={selectedMeals[meal]} onChange={() => toggleMealType(meal)} />}
            label={meal}
          />
          {selectedMeals[meal] && (
            <Box sx={{ml:3}}>
              <Typography>{suggestions[meal][suggestIdx[meal]]}</Typography>
              <Button size="small" variant="contained" onClick={() => acceptMeal(currentDay, meal)} disabled={!!isAccepted(meal)}>Accept</Button>
              <Button size="small" sx={{ml:1}} onClick={() => shuffleMeal(meal)}>Shuffle</Button>
            </Box>
          )}
        </Box>
      ))}
      <Box sx={{display:'flex', justifyContent:'space-between'}}>
        <Button onClick={prev} disabled={step===0}>Back</Button>
        <Button variant="contained" onClick={next} disabled={!allAccepted()}>Next</Button>
      </Box>
    </Box>
  );
}
