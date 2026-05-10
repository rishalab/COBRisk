       IDENTIFICATION DIVISION.
       PROGRAM-ID. VALCUST.
      * Customer Validation Utility
      * Called by CUSTPROC to validate customer records
      * Author: Legacy Systems Team
      * Date: 1998-03-15
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 WS-VALID-FLAG    PIC X VALUE 'Y'.
       01 WS-MSG           PIC X(50).
       LINKAGE SECTION.
       01 LK-CUSTOMER.
          05 LK-CUST-ID    PIC 9(8).
          05 LK-CUST-NAME  PIC X(30).
          05 LK-BALANCE    PIC S9(9)V99 COMP-3.
          05 LK-STATUS     PIC X(2).
       PROCEDURE DIVISION USING LK-CUSTOMER.
       VALIDATE-MAIN.
      * Check customer ID is not zero
           IF LK-CUST-ID = ZEROS
               MOVE 'N' TO WS-VALID-FLAG
               MOVE 'INVALID CUST ID' TO WS-MSG.
      * Check name is not blank
           IF LK-CUST-NAME = SPACES
               MOVE 'N' TO WS-VALID-FLAG
               MOVE 'BLANK NAME' TO WS-MSG.
      * Check balance within range
           IF LK-BALANCE < -999999.99
               MOVE 'N' TO WS-VALID-FLAG.
           GOBACK.
