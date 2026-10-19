// Extracted from WMSTST Oracle metadata (AL32UTF8); no business records.
export const freightColumnRules: Record<string, Record<string, { maxLength: number; maxBytes?: number }>> = {
  "TF_ENQUIRY": {
    "enquiry_nr": {
      "maxLength": 15,
      "maxBytes": 15
    },
    "company_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "prin_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "dept_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "origin_port": {
      "maxLength": 55,
      "maxBytes": 55
    },
    "destination_port": {
      "maxLength": 55,
      "maxBytes": 55
    },
    "transit_time": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "cargo_detail": {
      "maxLength": 200,
      "maxBytes": 200
    },
    "frequency": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "tos": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "commodity": {
      "maxLength": 100,
      "maxBytes": 100
    },
    "dimension": {
      "maxLength": 100,
      "maxBytes": 100
    },
    "carrier": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "remarks": {
      "maxLength": 200,
      "maxBytes": 200
    },
    "payment_terms": {
      "maxLength": 3,
      "maxBytes": 3
    },
    "curr_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "job_type": {
      "maxLength": 3,
      "maxBytes": 3
    },
    "transport_mode": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "userid": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "via": {
      "maxLength": 100,
      "maxBytes": 100
    },
    "ind_job": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "job_number": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "country_destination": {
      "maxLength": 60,
      "maxBytes": 60
    },
    "country_origin": {
      "maxLength": 60,
      "maxBytes": 60
    },
    "indstatus": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "enquiry_type": {
      "maxLength": 3,
      "maxBytes": 3
    },
    "spl_instructions": {
      "maxLength": 250,
      "maxBytes": 250
    },
    "salesman_code": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "member_type": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "sale_type": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "walkin_prin_code": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "shipper_name": {
      "maxLength": 100,
      "maxBytes": 100
    },
    "shipper_address": {
      "maxLength": 300,
      "maxBytes": 300
    },
    "consignee_name": {
      "maxLength": 100,
      "maxBytes": 100
    },
    "consignee_address": {
      "maxLength": 300,
      "maxBytes": 300
    },
    "job_category": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "ref_enquiry_type": {
      "maxLength": 3,
      "maxBytes": 3
    },
    "ref_enquiry_nr": {
      "maxLength": 15,
      "maxBytes": 15
    },
    "forwarder_code": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "shipment_status": {
      "maxLength": 70,
      "maxBytes": 70
    },
    "container_type": {
      "maxLength": 40,
      "maxBytes": 40
    },
    "vehicle_type": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "t_f": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "canceled": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "cancel_by": {
      "maxLength": 30,
      "maxBytes": 30
    },
    "cancel_remarks": {
      "maxLength": 250,
      "maxBytes": 250
    },
    "approved_by": {
      "maxLength": 30,
      "maxBytes": 30
    },
    "approval_remarks": {
      "maxLength": 250,
      "maxBytes": 250
    },
    "last_action": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "final_approved": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "next_action_by": {
      "maxLength": 30,
      "maxBytes": 30
    },
    "sentback_reason": {
      "maxLength": 500,
      "maxBytes": 500
    },
    "reject_reason": {
      "maxLength": 500,
      "maxBytes": 500
    },
    "submitted_by": {
      "maxLength": 30,
      "maxBytes": 30
    }
  },
  "TF_ENQUIRY_DET": {
    "company_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "prin_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "enquiry_nr": {
      "maxLength": 15,
      "maxBytes": 15
    },
    "act_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "uom": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "userid": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "curr_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "uoc": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "moc1": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "moc2": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "origin_port": {
      "maxLength": 55,
      "maxBytes": 55
    },
    "destination_port": {
      "maxLength": 55,
      "maxBytes": 55
    },
    "transport_mode": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "cost_curr_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "partners_curr_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "enquiry_type": {
      "maxLength": 3,
      "maxBytes": 3
    },
    "remarks": {
      "maxLength": 250,
      "maxBytes": 250
    }
  },
  "TF_QUOTATION": {
    "quotation_nr": {
      "maxLength": 15,
      "maxBytes": 15
    },
    "company_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "prin_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "dept_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "origin_port": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "destination_port": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "transit_time": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "cargo_detail": {
      "maxLength": 200,
      "maxBytes": 200
    },
    "frequency": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "tos": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "commodity": {
      "maxLength": 100,
      "maxBytes": 100
    },
    "dimension": {
      "maxLength": 100,
      "maxBytes": 100
    },
    "carrier": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "remarks": {
      "maxLength": 200,
      "maxBytes": 200
    },
    "payment_terms": {
      "maxLength": 3,
      "maxBytes": 3
    },
    "curr_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "job_type": {
      "maxLength": 3,
      "maxBytes": 3
    },
    "transport_mode": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "userid": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "via": {
      "maxLength": 100,
      "maxBytes": 100
    },
    "ind_job": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "job_number": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "country_destination": {
      "maxLength": 60,
      "maxBytes": 60
    },
    "country_origin": {
      "maxLength": 60,
      "maxBytes": 60
    },
    "indstatus": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "quotation_type": {
      "maxLength": 3,
      "maxBytes": 3
    },
    "enquiry_no": {
      "maxLength": 15,
      "maxBytes": 15
    },
    "spl_instructions": {
      "maxLength": 1000,
      "maxBytes": 1000
    },
    "salesman_code": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "member_type": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "sale_type": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "job_category": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "enquiry_type": {
      "maxLength": 3,
      "maxBytes": 3
    },
    "forwarder_code": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "shipment_status": {
      "maxLength": 70,
      "maxBytes": 70
    },
    "container_type": {
      "maxLength": 40,
      "maxBytes": 40
    },
    "vehicle_type": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "t_f": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "walkin_prin_code": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "contact_person": {
      "maxLength": 100,
      "maxBytes": 100
    },
    "subject": {
      "maxLength": 200,
      "maxBytes": 200
    },
    "approved_by": {
      "maxLength": 30,
      "maxBytes": 30
    },
    "approval_remarks": {
      "maxLength": 250,
      "maxBytes": 250
    },
    "last_action": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "final_approved": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "next_action_by": {
      "maxLength": 30,
      "maxBytes": 30
    },
    "sentback_reason": {
      "maxLength": 500,
      "maxBytes": 500
    },
    "reject_reason": {
      "maxLength": 500,
      "maxBytes": 500
    },
    "submitted_by": {
      "maxLength": 30,
      "maxBytes": 30
    }
  },
  "TF_QUOTATION_DET": {
    "company_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "prin_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "quotation_nr": {
      "maxLength": 15,
      "maxBytes": 15
    },
    "act_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "uom": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "userid": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "curr_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "uoc": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "moc1": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "moc2": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "origin_port": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "destination_port": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "transport_mode": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "cost_curr_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "partners_curr_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "activity_remarks": {
      "maxLength": 100,
      "maxBytes": 100
    },
    "rate_remarks": {
      "maxLength": 100,
      "maxBytes": 100
    }
  },
  "TF_QUOTATION_TERMS": {
    "company_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "prin_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "quotation_nr": {
      "maxLength": 15,
      "maxBytes": 15
    },
    "seq_no": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "sr_no": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "description": {
      "maxLength": 300,
      "maxBytes": 300
    },
    "font_type": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "font_size": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "user_id": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "type_ind": {
      "maxLength": 1,
      "maxBytes": 1
    }
  },
  "TI_JOB": {
    "company_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "prin_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "job_no": {
      "maxLength": 15,
      "maxBytes": 15
    },
    "job_type": {
      "maxLength": 3,
      "maxBytes": 3
    },
    "job_class": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "dept_code": {
      "maxLength": 6,
      "maxBytes": 6
    },
    "transport_mode": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "doc_ref": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "port_code": {
      "maxLength": 8,
      "maxBytes": 8
    },
    "description1": {
      "maxLength": 80,
      "maxBytes": 80
    },
    "description2": {
      "maxLength": 80,
      "maxBytes": 80
    },
    "prin_ref1": {
      "maxLength": 80,
      "maxBytes": 80
    },
    "prin_ref2": {
      "maxLength": 80,
      "maxBytes": 80
    },
    "remarks": {
      "maxLength": 250,
      "maxBytes": 250
    },
    "payment_terms": {
      "maxLength": 3,
      "maxBytes": 3
    },
    "curr_code": {
      "maxLength": 3,
      "maxBytes": 3
    },
    "cust_code": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "container_flag": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "container": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "packdet": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "allocated": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "canceled": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "confirmed": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "invoiced": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "completed": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "user_id": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "exp_jobno": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "picked": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "ordered": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "destination_port": {
      "maxLength": 8,
      "maxBytes": 8
    },
    "vessel_name": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "voyage_no": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "payableat": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "place_receipt": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "place_delivery": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "broker_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "quotation_ref": {
      "maxLength": 15,
      "maxBytes": 15
    },
    "be_no": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "deposit_collected": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "be_deposits": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "ind_freight": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "country_origin": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "country_destination": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "custom_recno": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "doc_ref2": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "hawb": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "reexport": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "ref_jobno": {
      "maxLength": 200,
      "maxBytes": 200
    },
    "combined_jobno": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "carrier": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "job_lock": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "courier_code": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "delivery_point": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "dep_doc_type": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "dep_permit_no": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "dep_remarks": {
      "maxLength": 1000,
      "maxBytes": 1000
    },
    "dep_remit_no": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "doc_deposit_currency": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "doc_depositd": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "exitbill1": {
      "maxLength": 25,
      "maxBytes": 25
    },
    "exitbill2": {
      "maxLength": 25,
      "maxBytes": 25
    },
    "job_integration_class": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "ref_customs": {
      "maxLength": 30,
      "maxBytes": 30
    },
    "driver_ref": {
      "maxLength": 40,
      "maxBytes": 40
    },
    "driver_remarks": {
      "maxLength": 250,
      "maxBytes": 250
    },
    "div_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "salesman_code": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "health_status": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "transit_time": {
      "maxLength": 60,
      "maxBytes": 60
    },
    "doccument_check": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "delivery_remarks": {
      "maxLength": 250,
      "maxBytes": 250
    },
    "cargo_received": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "delivered_by": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "checklist_no": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "backorder_pick": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "canceled_by": {
      "maxLength": 25,
      "maxBytes": 25
    },
    "cancel_remarks": {
      "maxLength": 250,
      "maxBytes": 250
    },
    "send_mail": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "backlog_mail": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "dplan_flag": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "trans_batch_id": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "send_mail_dn": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "kpi_inc": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "kpi_exc_remark": {
      "maxLength": 100,
      "maxBytes": 100
    },
    "job_category": {
      "maxLength": 200,
      "maxBytes": 200
    },
    "edit_user": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "tx_cat_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "bcf_code": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "dec_type": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "lab_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "test_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "dec_no": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "tally_type": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "member_type": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "sale_type": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "forwarder_code": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "contr_deposit": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "temp_exp": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "feeder_vessel_name": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "job_flag": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "house_apprtn": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "walkin_prin_code": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "updated_by": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "created_by": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "job_classification": {
      "maxLength": 100,
      "maxBytes": 100
    },
    "load_point": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "request_category": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "document_check": {
      "maxLength": 10,
      "maxBytes": 10
    }
  },
  "TN_INVOICE_DET": {
    "invoice_no": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "act_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "inv_desc": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "bill_recd": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "user_id": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "company_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "prin_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "job_no": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "other_services": {
      "maxLength": 100,
      "maxBytes": 100
    },
    "job_type": {
      "maxLength": 3,
      "maxBytes": 3
    },
    "consolidated_invno": {
      "maxLength": 12,
      "maxBytes": 12
    },
    "curr_code": {
      "maxLength": 3,
      "maxBytes": 3
    },
    "cancelled": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "transporter_code": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "vehicle_no": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "trans_docno": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "cust_code": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "broker_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "flag_freight": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "confirmed": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "print_flag": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "emp_id": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "moc1": {
      "maxLength": 2,
      "maxBytes": 2
    },
    "moc2": {
      "maxLength": 2,
      "maxBytes": 2
    },
    "uoc": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "srvact_refno": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "div_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "fm_point": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "to_point": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "driver_code": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "edit_user": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "tx_cat_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "tx_compntcat_code_1": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "tx_compntcat_code_2": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "tx_compntcat_code_3": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "tx_compntcat_code_4": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "tx_compnt_1_expmt": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "tx_compnt_2_expmt": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "tx_compnt_3_expmt": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "tx_compnt_4_expmt": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "tx_cat_code_cost": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "tx_compntcat_code_1_cost": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "tx_compntcat_code_2_cost": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "tx_compntcat_code_3_cost": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "tx_compntcat_code_4_cost": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "tx_compnt_1_expmt_cost": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "tx_compnt_2_expmt_cost": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "tx_compnt_3_expmt_cost": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "tx_compnt_4_expmt_cost": {
      "maxLength": 1,
      "maxBytes": 1
    },
    "remarks": {
      "maxLength": 250,
      "maxBytes": 250
    },
    "cheq_details": {
      "maxLength": 200,
      "maxBytes": 200
    },
    "cheq_card_no": {
      "maxLength": 200,
      "maxBytes": 200
    },
    "chq_card_no": {
      "maxLength": 200,
      "maxBytes": 200
    },
    "payment_mode": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "bill_curr_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "ac_curr_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "tp_curr_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "partner_curr_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "other_bill_curr_code": {
      "maxLength": 5,
      "maxBytes": 5
    }
  },
  "MS_AIRLINE": {
    "company_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "airline_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "airline_name": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "airline_no": {
      "maxLength": 25,
      "maxBytes": 25
    },
    "contact_person": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "address": {
      "maxLength": 200,
      "maxBytes": 200
    },
    "tel_no": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "fax_no": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "email": {
      "maxLength": 25,
      "maxBytes": 25
    }
  },
  "TF_AIRLINE_TARIFF": {
    "company_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "airline_code": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "airline_name": {
      "maxLength": 100,
      "maxBytes": 100
    },
    "source": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "destination": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "iata_code": {
      "maxLength": 20,
      "maxBytes": 20
    },
    "curr_code": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "hard_freight": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "perishable": {
      "maxLength": 5,
      "maxBytes": 5
    },
    "direct_via": {
      "maxLength": 50,
      "maxBytes": 50
    },
    "restriction": {
      "maxLength": 10,
      "maxBytes": 10
    },
    "restriction_det": {
      "maxLength": 200,
      "maxBytes": 200
    },
    "user_id": {
      "maxLength": 10,
      "maxBytes": 10
    }
  }
};
