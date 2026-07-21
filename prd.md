GENERAL REQUIREMENTS
This website is for Aravalli Auditorium.
The auditorium shows ONE movie every week.
The movie changes every week based on a public poll.
Shows run only on:
Wednesday
Thursday
Friday
Saturday
Sunday
Show timings:
Wednesday:
7:00 PM
Thursday:
7:00 PM
Friday:
7:00 PM
Saturday:
2:00 PM
7:00 PM
Sunday:
2:00 PM
7:00 PM
No shows on Monday or Tuesday.
====================================
NO LOGIN REQUIRED
Customers should NOT need to create an account.
Booking should require only:
Full Name
Phone Number
Optional Email
Seat Selection
Payment
That's all.
====================================
MOVIE POLL
Create a poll section.
Admin can add multiple movie options every week.
Visitors can vote only once using phone verification or browser fingerprint/local storage.
Display:
Movie Poster
Movie Name
Votes
Percentage
Voting ends automatically on a configurable day.
After voting ends:
Winning movie becomes the next week's movie.
Admin can override manually.
====================================
SEAT MAP
Create a professional auditorium seat layout.
The seat map should NOT be hardcoded.
Admin should be able to create:
Sections
Rows
Columns
Seat numbers
Seat prefixes
Seat categories
Seat prices
Examples:
Balcony
Ground Left
Ground Right
VIP
Gold
Silver
Bronze
The admin can:
Add seats
Delete seats
Rename rows
Change numbering
Create new sections
Hide seats
Disable seats
Seat colors:
Green = Available
Red = Booked
Yellow = Reserved
Blue = Selected
Gray = Disabled
Purple = VIP
Users click seats directly from the map.
Maximum seats selectable should be configurable.
====================================
RESERVED SEATS
Admin can reserve any seat.
Reserved seats cannot be booked online.
Admin can also release reserved seats.
====================================
LIVE AVAILABILITY
Seat availability updates live.
If another user books a seat,
everyone else immediately sees it become unavailable.
Prevent double booking.
====================================
PAYMENT
Continue using Razorpay.
Only after successful payment:
Create booking
Generate ticket
Generate QR Code
Send confirmation
====================================
QR CODE
Generate a unique QR Code for every booking.
QR should contain only Booking ID.
Example:
ARA202600124
Store booking in database.
====================================
CONFIRMATION PAGE
After payment show:
Booking Successful
Movie
Date
Time
Seat Numbers
Booking ID
Download QR Ticket
Print Ticket
====================================
EMAIL
Automatically send confirmation email.
Include:
Movie
Date
Time
Seats
Booking ID
QR Code
====================================
WHATSAPP READY
Design backend in a way that WhatsApp Business API can be plugged in later.
Create a notification service abstraction.
Methods:
send_email()
send_sms()
send_whatsapp()
Only email needs implementation now.
====================================
SMS READY
Keep SMS service modular.
Future providers:
Twilio
MSG91
Fast2SMS
No hardcoding.
====================================
ADMIN PANEL
Create Admin Dashboard.
Dashboard should include:
Today's Bookings
Today's Revenue
Weekly Revenue
Monthly Revenue
Occupancy
Upcoming Shows
Poll Results
Current Movie
Next Movie
Reserved Seats
====================================
MOVIES
Admin can:
Upload poster
Add trailer link
Synopsis
Duration
Genre
Certificate
Language
Cast
Director
Release Year
====================================
SHOW MANAGEMENT
Admin can:
Create new movie
Assign movie to week
Configure dates
Configure timings
Enable/disable shows
Duplicate previous week's settings
====================================
BOOKINGS
Admin can:
View bookings
Cancel bookings
Refund manually
Search bookings
Filter by movie
Filter by date
Filter by phone number
Export CSV
====================================
CHECK-IN
Create QR Scanner page.
When QR is scanned:
Display booking.
Mark ticket as used.
Second scan should display:
Ticket Already Used
====================================
DESIGN
Premium dark theme.
Background:
#0F1115
Cards:
#20252C
Accent:
Gold (#D4AF37)
Typography:
Inter
Responsive.
Works perfectly on:
Desktop
Tablet
Mobile
No horizontal scrolling except seat map.
====================================
REMOVE
Remove:
Location Map
Google Maps
Location icons
Anything unnecessary.
====================================
CODE QUALITY
Write production-quality code.
Use reusable components.
Keep code modular.
Avoid duplication.
Document important functions.
Maintain clean architecture.
Do NOT rewrite everything.
Upgrade the existing project intelligently while preserving existing functionality.
