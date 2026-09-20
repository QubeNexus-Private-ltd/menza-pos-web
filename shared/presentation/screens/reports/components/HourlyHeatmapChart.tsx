import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { HourlySalesSlot } from '../../../../domain/models/Report';
import { Flame, Clock, Utensils, Moon, Coffee } from 'lucide-react-native';

interface HourlyHeatmapChartProps {
  slots: HourlySalesSlot[];
  peakHourLabel?: string;
  peakHourSales?: number;
}

export const HourlyHeatmapChart: React.FC<HourlyHeatmapChartProps> = ({
  slots,
  peakHourLabel,
  peakHourSales,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<HourlySalesSlot | null>(null);

  if (!slots || slots.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No hourly sales data available</Text>
      </View>
    );
  }

  const maxSlotSales = Math.max(...slots.map((s) => s.totalSales), 1);
  const totalDayOrders = slots.reduce((acc, s) => acc + s.ordersCount, 0);

  // Operational Time Bands Calculation
  const lunchOrders = slots
    .filter((s) => s.hour >= 12 && s.hour <= 15)
    .reduce((acc, s) => acc + s.ordersCount, 0);
  const dinnerOrders = slots
    .filter((s) => s.hour >= 19 && s.hour <= 22)
    .reduce((acc, s) => acc + s.ordersCount, 0);

  return (
    <View style={styles.container}>
      {/* Peak Callout Banner */}
      <View style={styles.peakCalloutBanner}>
        <View style={styles.peakBadge}>
          <Flame size={12} color="#D96B14" />
          <Text style={styles.peakBadgeText}>PEAK RUSH HOUR</Text>
        </View>
        <Text style={styles.peakHourValue}>
          {peakHourLabel || 'N/A'}{' '}
          <Text style={{ color: '#DE8626' }}>• ₹{(peakHourSales || 0).toLocaleString('en-IN')}</Text>
        </Text>
      </View>

      {/* Interactive Inspector Card */}
      {selectedSlot ? (
        <View style={styles.inspectorBox}>
          <View style={styles.inspectorTop}>
            <Text style={styles.inspectorHour}>{selectedSlot.hourLabel || `${selectedSlot.hour}:00 - ${selectedSlot.hour + 1}:00`}</Text>
            <Text style={styles.inspectorRevenue}>₹{selectedSlot.totalSales.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.inspectorBottom}>
            <Text style={styles.inspectorSub}>
              Orders:{' '}
              <Text style={{ color: '#17845A', fontWeight: '700' }}>
                {selectedSlot.ordersCount} ({selectedSlot.completedOrders} served)
              </Text>
            </Text>
            <Text style={styles.inspectorSub}>
              Share:{' '}
              <Text style={{ color: '#DE8626', fontWeight: '700' }}>
                {totalDayOrders > 0 ? ((selectedSlot.ordersCount / totalDayOrders) * 100).toFixed(1) : 0}%
              </Text>
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.inspectorHint}>
          <Text style={styles.inspectorHintText}>Tap any hourly column to inspect revenue & order rush</Text>
        </View>
      )}

      {/* 24-Hour Column Chart */}
      <View style={styles.barsContainer}>
        {slots.map((slot) => {
          const ratio = slot.totalSales / maxSlotSales;
          const barHeight = Math.max(ratio * 95, slot.ordersCount > 0 ? 8 : 4);
          const isSelected = selectedSlot?.hour === slot.hour;
          const isPeak = slot.totalSales > 0 && slot.totalSales >= maxSlotSales * 0.85;
          const isLunch = slot.hour >= 12 && slot.hour <= 15;
          const isDinner = slot.hour >= 19 && slot.hour <= 22;

          let barColor = '#EDE8E1';
          if (isSelected) {
            barColor = '#DE8626';
          } else if (isPeak) {
            barColor = '#F59E0B';
          } else if (isDinner) {
            barColor = '#17845A';
          } else if (isLunch) {
            barColor = '#346CB0';
          } else if (slot.totalSales > 0) {
            barColor = 'rgba(222, 134, 38, 0.4)';
          }

          return (
            <TouchableOpacity
              key={`hour-slot-${slot.hour}`}
              style={styles.slotColumn}
              activeOpacity={0.7}
              onPress={() => setSelectedSlot(selectedSlot?.hour === slot.hour ? null : slot)}
            >
              <View style={styles.barSlotTrack}>
                <View
                  style={[
                    styles.barCapsule,
                    {
                      height: barHeight,
                      backgroundColor: barColor,
                      borderColor: isSelected ? '#D96B14' : 'transparent',
                      borderWidth: isSelected ? 1 : 0,
                    },
                  ]}
                />
              </View>
              {slot.hour % 3 === 0 && (
                <Text style={[styles.hourTickText, (isLunch || isDinner || isPeak) && { color: '#5C4E3D' }]}>
                  {slot.hour}h
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Operational Shift Rush Pills */}
      <View style={styles.shiftsGrid}>
        <View style={styles.shiftCard}>
          <View style={styles.shiftHeader}>
            <Utensils size={12} color="#346CB0" />
            <Text style={styles.shiftTitle}>Lunch Shift</Text>
          </View>
          <Text style={styles.shiftTime}>12:00 - 15:00</Text>
          <Text style={styles.shiftOrders}>{lunchOrders} Orders</Text>
        </View>

        <View style={styles.shiftCard}>
          <View style={styles.shiftHeader}>
            <Flame size={12} color="#17845A" />
            <Text style={styles.shiftTitle}>Dinner Rush</Text>
          </View>
          <Text style={styles.shiftTime}>19:00 - 22:00</Text>
          <Text style={styles.shiftOrders}>{dinnerOrders} Orders</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginVertical: 4,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    elevation: 1,
  },
  peakCalloutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
    marginBottom: 8,
  },
  peakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  peakBadgeText: {
    color: '#D96B14',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  peakHourValue: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '700',
  },
  inspectorBox: {
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  inspectorTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inspectorHour: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '700',
  },
  inspectorRevenue: {
    color: '#DE8626',
    fontSize: 13,
    fontWeight: '900',
  },
  inspectorBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E7E1DA',
  },
  inspectorSub: {
    color: '#7C6F62',
    fontSize: 10,
  },
  inspectorHint: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inspectorHintText: {
    color: '#7C6F62',
    fontSize: 10,
    fontStyle: 'italic',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 110,
    paddingTop: 6,
    paddingBottom: 4,
  },
  slotColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  barSlotTrack: {
    flex: 1,
    width: '75%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barCapsule: {
    width: '100%',
    borderRadius: 3,
  },
  hourTickText: {
    color: '#7C6F62',
    fontSize: 8,
    marginTop: 4,
  },
  shiftsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E7E1DA',
  },
  shiftCard: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shiftTitle: {
    color: '#1F2937',
    fontSize: 11,
    fontWeight: '700',
  },
  shiftTime: {
    color: '#7C6F62',
    fontSize: 9,
    marginTop: 2,
  },
  shiftOrders: {
    color: '#DE8626',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  emptyContainer: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  emptyText: {
    color: '#7C6F62',
    fontSize: 12,
  },
});
