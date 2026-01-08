import React, { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

interface DateRangePickerProps {
  date: DateRange | undefined;
  onSelect: (date: DateRange | undefined) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ date, onSelect }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={'outline'}
          className="w-[300px] justify-start text-left font-normal"
        >
          {date?.from ? (
            date.to ? (
              <>
                {format(date.from, 'LLL dd, y')} - {format(date.to, 'LLL dd, y')}
              </>
            ) : (
              format(date.from, 'LLL dd, y')
            )
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={onSelect}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
};

export default DateRangePicker;
