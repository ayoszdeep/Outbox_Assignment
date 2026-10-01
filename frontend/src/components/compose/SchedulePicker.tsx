
import { Input } from '../ui/Input';

interface SchedulePickerProps {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}

export const SchedulePicker: React.FC<SchedulePickerProps> = ({ date, time, onDateChange, onTimeChange }) => {
  return (
    <div className="p-4 bg-[#FFFAF0]  rounded-lg border border-gray-200 ">
      <h3 className="text-sm font-medium text-gray-900  mb-3">Schedule Date & Time</h3>
      <div className="flex space-x-4">
        <div className="flex-1">
          <Input 
            type="date" 
            label="Date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            min={new Date().toISOString().split('T')[0]} // Cannot schedule in past
          />
        </div>
        <div className="flex-1">
          <Input 
            type="time" 
            label="Time"
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
          />
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-500 ">
        Emails will begin sending at the specified date and time based on your local timezone.
      </p>
    </div>
  );
};
