# Project Summary & Agent Instructions

This document provides a summary of the "Installment Management System" project, its current state as of the end of our session, and a clear list of implemented vs. pending features to guide future work.

## 1. Application Overview

- **Purpose:** A comprehensive, multi-user, online system for managing installment sales.
- **Tech Stack:** React, TypeScript, Vite, Supabase.

## 2. Work Completed in This Session

The following features and fixes were successfully implemented, and the code has been reset to this stable baseline:

- **Security Overhaul:** Implemented strict, role-based Row Level Security (RLS) for all tables.
- **Database Hardening:** Fixed all "Function Search Path Mutable" warnings.
- **Robust Data Import:** The data import system for Customers, Transactions, and Payments was completely fixed. It now correctly handles legacy IDs via the `sequence_number` column and provides clearer error messages.
- **Core UI Bug Fixes:**
  - Fixed a crash on the customer search page.
  - Fixed an issue preventing customer names from displaying in the transaction list.
  - Corrected the payment import mapping UI.
- **Enhanced Transaction Form:** The form for adding new transactions was improved with `extra_price` and `notes` fields.
- **New Payments Page:** A new page was created at `/payments` to display a list of all recorded payments.
- **Manual Payment Form:** The modal form for adding new payments was verified and enhanced with a date picker and improved defaults.

## 3. Database & Connection Information

- **Provider:** Supabase
- **Project URL:** `https://odeqbnntvogchzipniig.supabase.co`
- **Project ID:** `odeqbnntvogchzipniig`
- **Anon Key (Public):** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXFibm50dm9nY2h6aXBuaWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5Mjc5OTgsImV4cCI6MjA3MjUwMzk5OH0.phWW0hNm-ujEEsngjhf88us4suJv9boQ_9uh7ADhTXQ`
- **Critical Workflow:** For data import, the user's original ID **must** be mapped to the **`sequence_number`** field ("م العميل") to ensure relationships are created correctly.

## 4. Pending & Future Work

The following features were requested or suggested but have **not** been implemented yet. They represent a good starting point for the next development task.

### Phase 1: List & Dashboard Enhancements (Immediate Next Steps)
- **Pagination:** Add "Load More" style pagination to the Customer, Transaction, and Payment lists.
- **Advanced Filtering & Sorting:** Add UI controls for backend-driven sorting and filtering (e.g., by date range on the transaction list).
- **Clickable Dashboard Stats:** Make the main dashboard statistics (e.g., "Overdue") clickable, linking to pre-filtered lists.

### Phase 2: Core Application Improvements
- **Dashboard Date Filter:** Add a global date range filter to the dashboard to view stats for specific periods.
- **Customer Detail Page:** Create a full profile page for each customer showing their details and a history of all their transactions and payments.
- **User-Friendly Error Messages:** Implement a system to translate raw database errors into clear, user-friendly Arabic messages.
- **Audit Log UI:** Create a page to view and search the `audit_log` table.

### Phase 3: Major New Features
- **Export to PDF:** Add a feature to export key documents (statements, receipts) as PDF files.
- **User Role Management UI:** Create a settings page for admins to manage user roles.
- **AI-Powered Features:**
  - Predictive Payment Reminders.
  - Customer Risk Scoring.
  - Automated Data Entry (OCR/NLP).
  - AI Chatbot.
