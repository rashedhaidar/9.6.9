import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
    import { Plus, Clock } from 'lucide-react';
    import { getCurrentWeekDates, formatDate, getDateOfWeek } from '../utils/dateUtils';
    import { DAYS } from '../constants/days';
    import { WeekDisplay } from './WeekDisplay';
    import { requestNotificationPermission, scheduleNotification } from '../utils/notifications';
    import { LIFE_DOMAINS } from '../types/domains';
    import { classifyActivity } from '../utils/activityClassifier';
    import { Activity } from '../types/activity';
    import { useActivities } from '../hooks/useActivities';
    import { ActivityContext } from '../context/ActivityContext';

    interface ActivityFormProps {
      onSubmit: (activity: {
        title: string;
        description?: string;
        targetCount?: number;
        selectedDays: number[];
        allowSunday: boolean;
        reminder?: {
          time: string;
          date: string;
        };
        domainId: string;
        goalId?: string;
      }) => void;
      initialDomainId?: string | null;
      hideDomainsSelect?: boolean;
      weekNumber: number;
      year: number;
      selectedDay?: number | null;
      activity?: Activity;
    }

    export function ActivityForm({
      onSubmit,
      initialDomainId,
      hideDomainsSelect,
      weekNumber,
      year,
      selectedDay,
      activity
    }: ActivityFormProps) {
      const [title, setTitle] = useState(activity?.title || '');
      const [description, setDescription] = useState(activity?.description || '');
      const [targetCount, setTargetCount] = useState(activity?.targetCount?.toString() || '');
      const [selectedDays, setSelectedDays] = useState<number[]>(activity?.selectedDays || []);
      const [allowSunday, setAllowSunday] = useState(activity?.allowSunday || false);
      const [reminderTime, setReminderTime] = useState(activity?.reminder?.time || '');
      const [domainId, setDomainId] = useState(initialDomainId || activity?.domainId || '');
      const [goalId, setGoalId] = useState(activity?.goalId || '');
      const context = useContext(ActivityContext);
      const activities = context ? context.activities : [];
      const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);

      const weekStartDate = useMemo(() => getDateOfWeek(weekNumber, year), [weekNumber, year]);
      const weekDates = useMemo(() => getCurrentWeekDates(weekStartDate), [weekStartDate]);

      // Remove the useEffect that automatically sets the domain
      /*useEffect(() => {
        if (title && !activity?.domainId) {
          const newDomainId = classifyActivity(title, description);
          setDomainId(newDomainId);
        }
      }, [title, description, activity?.domainId]);*/

      const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !domainId) return;

        let reminder = undefined;
        if (reminderTime) {
          try {
            const [hours, minutes] = reminderTime.split(':').map(Number);
            let reminderDate;
            if (activity && activity.reminder && activity.reminder.date) {
              reminderDate = new Date(activity.reminder.date);
            } else {
              reminderDate = selectedDay !== null ? new Date(weekDates[selectedDay]) : new Date();
            }
            reminderDate.setHours(hours, minutes, 0, 0);

            // Check if the reminderDate is a valid date
            if (isNaN(reminderDate.getTime())) {
              console.error("Invalid date created for reminder.");
              alert("Failed to create reminder. Please check the date and time.");
              return;
            }

            reminder = {
              time: reminderTime,
              date: reminderDate.toISOString(),
            };

            if (await requestNotificationPermission()) {
              scheduleNotification(title, { body: description }, reminderDate.getTime());
            }
          } catch (error) {
            console.error("Error creating reminder:", error);
            alert("Failed to create reminder. Please check the time format.");
            return;
          }
        }

        const newActivity = {
          title,
          description: description || undefined,
          targetCount: targetCount ? parseInt(targetCount) : undefined,
          selectedDays,
          allowSunday,
          reminder,
          domainId: domainId,
          goalId: goalId || undefined,
        };

        onSubmit(newActivity);
        setTitle('');
        setDescription('');
        setTargetCount('');
        setSelectedDays([]);
        setAllowSunday(false);
        setReminderTime('');
        setDomainId(initialDomainId || '');
        setGoalId('');
      }, [title, description, targetCount, selectedDays, allowSunday, reminderTime, domainId, onSubmit, selectedDay, weekDates, initialDomainId, goalId, activity]);

      const handleSelectAllDays = useCallback(() => {
        setSelectedDays([1, 2, 3, 4, 5, 6]);
      }, []);

      const inputClasses = "w-full p-2 border rounded-md bg-black/20 text-white border-amber-400/30 placeholder-white/50 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none";

      // Fetch goals from local storage
      const getGoalsByDomain = useMemo(() => {
        return (domainId: string) => {
          const saved = localStorage.getItem('goals');
          const goals = saved ? JSON.parse(saved) : [];
          return goals.filter((goal: any) => goal.domainId === domainId);
        };
      }, []);

      // Filter goals based on the selected domain
      const domainGoals = useMemo(() => {
        if (!domainId) {
          return [];
        }
        return getGoalsByDomain(domainId);
      }, [domainId, getGoalsByDomain]);

      const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value;
        setTitle(newTitle);

        // Suggest similar titles
        let similarTitles = (activities && Array.isArray(activities))
          ? activities
            .map(a => a.title)
            .filter(existingTitle =>
              existingTitle.toLowerCase().includes(newTitle.toLowerCase()) &&
              existingTitle !== newTitle
            )
          : [];

        // Deduplicate the suggestions
        similarTitles = [...new Set(similarTitles)];

        // Limit the number of suggestions
        similarTitles = similarTitles.slice(0, 5);

        setTitleSuggestions(similarTitles);
      }, [activities, setTitle, setTitleSuggestions]);

      const handleSelectSuggestion = useCallback((suggestion: string) => {
        setTitle(suggestion);
        setTitleSuggestions([]);
      }, [setTitle, setTitleSuggestions]);

      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="عنوان النشاط"
              className={inputClasses}
              dir="rtl"
            />
            {titleSuggestions.length > 0 && (
              <div className="bg-black/50 rounded-md mt-1 max-h-32 overflow-y-auto absolute z-10 w-full" dir="rtl">
                {titleSuggestions.map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className="block w-full text-white text-right p-2 hover:bg-white/10"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف النشاط"
              className={inputClasses}
              dir="rtl"
            />
          </div>

          <div>
            <input
              type="number"
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
              placeholder="العدد المستهدف"
              className={inputClasses}
              dir="rtl"
            />
          </div>
          {!hideDomainsSelect && (
            <div>
              <select
                value={domainId}
                onChange={(e) => setDomainId(e.target.value)}
                className={inputClasses}
                dir="rtl"
                required
              >
                <option value="" disabled>اختر المجال</option>
                {LIFE_DOMAINS.map(domain => (
                  <option key={domain.id} value={domain.id}>
                    {domain.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* Show goal selection only if a domain is selected */}
          {domainId && (
            <div>
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className={inputClasses}
                dir="rtl"
              >
                <option value="" disabled>اختر الهدف</option>
                {domainGoals.map((goal: any) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <WeekDisplay weekNumber={weekNumber} year={year} />
              <label className="block text-white" dir="rtl">أيام النشاط</label>
            </div>
            <div className="grid grid-cols-7 gap-2 bg-black/20 p-4 rounded-lg">
              {DAYS.map((day, index) => (
                <div key={day} className="text-center">
                  <label className="block text-sm text-white/70">{day}</label>
                  <div className="text-xs text-white/50 my-1">{formatDate(weekDates[index])}</div>
                  <input
                    type="checkbox"
                    checked={selectedDays.includes(index)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDays([...selectedDays, index]);
                      } else {
                        setSelectedDays(selectedDays.filter(d => d !== index));
                      }
                    }}
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleSelectAllDays}
              className="bg-gray-700 hover:bg-gray-600 text-white p-1 rounded-md text-sm"
            >
              تحديد الكل ما عدا الأحد
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allowSunday"
              checked={allowSunday}
              onChange={(e) => setAllowSunday(e.target.checked)}
            />
            <label htmlFor="allowSunday" className="text-white" dir="rtl">
              السماح بإضافة النشاط يوم الأحد
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-white" />
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className={inputClasses}
              dir="rtl"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-black p-2 rounded-md hover:from-purple-600 hover:to-pink-600 transition-all flex items-center justify-center gap-2 font-medium"
          >
            <Plus size={20} />
            حفظ
          </button>
        </form>
      );
    }
