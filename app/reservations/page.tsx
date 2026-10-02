'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Users,
  Clock,
  Phone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  Sparkles,
  Utensils,
  MapPin,
  CalendarCheck,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { WebReservationService, ReservationResponseDTO, CreateReservationRequestModel } from '@/services/reservationService';
import { TableRemoteDataSource } from '@shared/data/datasources/TableRemoteDataSource';
import { TableMaster } from '@shared/domain/models/Table';

const tableDataSource = new TableRemoteDataSource();

export default function ReservationsPage() {
  const { activeRestaurant, restaurants } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const [reservations, setReservations] = useState<ReservationResponseDTO[]>([]);
  const [tables, setTables] = useState<TableMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Booking Modal
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [guestCount, setGuestCount] = useState('2');
  const [reservationTime, setReservationTime] = useState('19:30');
  const [selectedTableId, setSelectedTableId] = useState<number | undefined>(undefined);
  const [specialNotes, setSpecialNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentRestId) return;
    try {
      setLoading(true);
      const [resList, tblList] = await Promise.allSettled([
        WebReservationService.getReservations(currentRestId, selectedDate, statusFilter),
        tableDataSource.getTables(currentRestId),
      ]);

      if (resList.status === 'fulfilled') {
        setReservations(resList.value);
      }
      if (tblList.status === 'fulfilled' && Array.isArray(tblList.value)) {
        setTables(tblList.value);
      }
    } catch (err) {
      console.warn('Failed to load reservations', err);
    } finally {
      setLoading(false);
    }
  }, [currentRestId, selectedDate, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || customerPhone.length !== 10) {
      alert('Please enter a valid customer name and 10-digit mobile number.');
      return;
    }

    try {
      setIsSubmitting(true);
      const chosenTable = tables.find((t) => t.id === selectedTableId);
      const payload: CreateReservationRequestModel = {
        restaurantId: currentRestId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        guestCount: parseInt(guestCount, 10) || 2,
        reservationDate: selectedDate,
        reservationTime,
        tableId: selectedTableId,
        tableNumber: chosenTable?.tableNumber,
        sectionName: chosenTable?.sectionName || 'Main Dining',
        specialNotes: specialNotes.trim() || undefined,
        status: 'Confirmed',
      };

      await WebReservationService.createReservation(payload);
      await loadData();
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setSpecialNotes('');
      setBookingModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to create reservation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: 'Confirmed' | 'Seated' | 'Cancelled' | 'Completed') => {
    try {
      await WebReservationService.updateStatus(id, newStatus, currentRestId);
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
    } catch (err: any) {
      alert(err?.message || 'Failed to update reservation status');
    }
  };

  const handleSeatGuests = async (res: ReservationResponseDTO) => {
    try {
      await WebReservationService.seatReservation(res.id, res.tableId, res.tableNumber);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to seat reservation');
    }
  };

  const filteredReservations = reservations.filter((r) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.customerName.toLowerCase().includes(q) ||
        r.customerPhone.includes(q) ||
        r.reservationCode.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const confirmedCount = reservations.filter((r) => r.status?.toLowerCase() === 'confirmed').length;
  const seatedCount = reservations.filter((r) => r.status?.toLowerCase() === 'seated').length;

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                  Table Reservations
                </h1>
                <span className="rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-[#DE8626]">
                  {confirmedCount} Confirmed • {seatedCount} Seated
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
                Advance table booking, guest time slots, capacity allocation, and guest seating
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={() => setBookingModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Book Table</span>
              </button>
            </div>
          </div>

          {/* Controls: Date Picker, Status Tabs, Search */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Date Selector */}
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-[#DE8626]" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 py-1.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                />
                <button
                  onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                  className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 py-1.5 text-xs font-semibold text-[#667085] hover:text-[#1E2930]"
                >
                  Today
                </button>
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-1 text-xs">
                {(['ALL', 'Confirmed', 'Seated', 'Completed', 'Cancelled'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                      statusFilter === st
                        ? 'bg-white dark:bg-[#1B2127] text-[#DE8626] shadow-sm'
                        : 'text-[#667085] hover:text-[#1E2930]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search guest name, phone, or reservation code..."
                className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-10 pr-4 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
              />
            </div>
          </div>

          {/* Reservations List */}
          {loading ? (
            <div className="py-16 text-center text-xs text-[#667085] dark:text-[#94A3B8]">
              Loading reservations...
            </div>
          ) : filteredReservations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] p-12 text-center">
              <CalendarCheck className="h-10 w-10 text-[#667085] mx-auto mb-3 opacity-40" />
              <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">No reservations found</h3>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1 max-w-sm mx-auto">
                No guest bookings for {selectedDate}. Click "Book Table" to create a new reservation.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReservations.map((res) => {
                const isConfirmed = res.status?.toLowerCase() === 'confirmed';
                const isSeated = res.status?.toLowerCase() === 'seated';
                const isCancelled = res.status?.toLowerCase() === 'cancelled';
                const isCompleted = res.status?.toLowerCase() === 'completed';

                return (
                  <div
                    key={res.id}
                    className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4 hover:border-[#DE8626]/50 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                            {res.customerName}
                          </h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isConfirmed
                                ? 'bg-amber-500/10 text-[#DE8626]'
                                : isSeated
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : isCompleted
                                ? 'bg-blue-500/10 text-blue-600'
                                : 'bg-red-500/10 text-red-600'
                            }`}
                          >
                            {res.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#667085] dark:text-[#94A3B8] flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" />
                          <span>+91 {res.customerPhone}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono text-[#667085]">#{res.reservationCode || res.id}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs rounded-xl bg-[#FAF7F2] dark:bg-[#151A20] p-3">
                      <div>
                        <span className="text-[11px] text-[#667085] block">Time Slot</span>
                        <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6] flex items-center gap-1 mt-0.5">
                          <Clock className="h-3.5 w-3.5 text-[#DE8626]" />
                          {res.reservationTime}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-[#667085] block">Party Size</span>
                        <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6] flex items-center gap-1 mt-0.5">
                          <Users className="h-3.5 w-3.5 text-[#DE8626]" />
                          {res.guestCount} Guests
                        </span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60 flex justify-between items-center">
                        <span className="text-[11px] text-[#667085]">Assigned Table</span>
                        <span className="font-bold text-[#DE8626]">
                          {res.tableNumber ? `Table #${res.tableNumber}` : 'Unassigned'}
                        </span>
                      </div>
                    </div>

                    {res.specialNotes && (
                      <p className="text-xs text-[#667085] dark:text-[#94A3B8] italic bg-amber-500/5 p-2 rounded-lg border border-amber-500/20">
                        "{res.specialNotes}"
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-1 border-t border-[#E7E1DA] dark:border-[#2B3540]">
                      {isConfirmed && (
                        <>
                          <button
                            onClick={() => handleSeatGuests(res)}
                            className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
                          >
                            <Utensils className="h-3.5 w-3.5" />
                            <span>Seat Guests</span>
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(res.id, 'Cancelled')}
                            className="px-3 py-2 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 text-xs font-bold hover:bg-red-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {isSeated && (
                        <button
                          onClick={() => handleUpdateStatus(res.id, 'Completed')}
                          className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Mark Completed</span>
                        </button>
                      )}

                      {isCompleted && (
                        <span className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" />
                          <span>Completed</span>
                        </span>
                      )}

                      {isCancelled && (
                        <span className="text-xs text-red-500 font-semibold flex items-center gap-1">
                          <X className="h-3.5 w-3.5" />
                          <span>Cancelled</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Book Table Modal */}
        {bookingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626]">
                    <CalendarIcon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                    Book Table Reservation
                  </h3>
                </div>
                <button
                  onClick={() => setBookingModalOpen(false)}
                  className="rounded-lg p-1 text-[#667085] hover:bg-black/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateReservation} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Customer Full Name *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">10-Digit Mobile *</label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="9876543210"
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 outline-none focus:border-[#DE8626]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Guest Count *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={50}
                      value={guestCount}
                      onChange={(e) => setGuestCount(e.target.value)}
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 outline-none focus:border-[#DE8626]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Reservation Date</label>
                    <input
                      type="date"
                      required
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 outline-none focus:border-[#DE8626]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Time Slot (HH:mm)</label>
                    <input
                      type="time"
                      required
                      value={reservationTime}
                      onChange={(e) => setReservationTime(e.target.value)}
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 outline-none focus:border-[#DE8626]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Assign Table (Optional)</label>
                  <select
                    value={selectedTableId || ''}
                    onChange={(e) => setSelectedTableId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 outline-none focus:border-[#DE8626]"
                  >
                    <option value="">Auto-Assign / Decide Later</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        Table #{t.tableNumber} - {t.sectionName || 'Main Dining'} ({t.seatingCapacity} seats)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Special Notes / Dietary Preferences</label>
                  <textarea
                    rows={2}
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value)}
                    placeholder="e.g. Birthday anniversary, window seat preference, high chair required..."
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E7E1DA] dark:border-[#2B3540]">
                  <button
                    type="button"
                    onClick={() => setBookingModalOpen(false)}
                    className="rounded-xl border border-[#E7E1DA] px-4 py-2 text-xs font-semibold text-[#667085]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] disabled:opacity-50"
                  >
                    {isSubmitting ? 'Booking...' : 'Confirm Reservation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}
