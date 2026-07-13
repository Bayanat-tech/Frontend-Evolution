import { Fragment, useMemo, useState } from 'react';
import { FaChevronDown, FaChevronRight, FaRegCalendarAlt, FaRegImage, FaSearch } from 'react-icons/fa';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField
} from '../../../../components/mms_ui';
import { InspectionReportStructureRow } from '../types/inspectionReportApi.types';
import { InspectionItemResponse, InspectionItemValue } from '../types/AddInspectionReportPage.types';

type GroupedInspectionSection = {
  header_section_id: string;
  header_section_title: string;
  items: InspectionReportStructureRow[];
};

type DoInspectionSectionProps = {
  groupedInspectionStructure: GroupedInspectionSection[];
  expandedSectionIds: string[];
  inspectionResponses: Record<string, InspectionItemResponse>;
  onToggleSection: (sectionId: string) => void;
  onSaveInspectionItem: (payload: InspectionItemResponse) => void;
  onNext: () => void;
};

const getTypeOptions = (type: string): string[] => {
  const key = (type || '').trim().toLowerCase();

  if (key === 'good-repair-replace-na') return ['Good', 'Repair', 'Replace', 'NA'];
  if (key === 'yes-no-na') return ['Yes', 'No', 'NA'];
  if (key === 'pass-fail-na') return ['Pass', 'Fail', 'NA'];
  if (key === 'ok-faulty-na') return ['Ok', 'Faulty', 'NA'];

  return [];
};

const squareIconButtonClass =
  'min-w-[34px] px-[7px] py-[4.5px] rounded-lg bg-[#e5e7eb] text-[#1f2937]';

const DoInspectionSection = ({
  groupedInspectionStructure,
  expandedSectionIds,
  inspectionResponses,
  onToggleSection,
  onSaveInspectionItem,
  onNext
}: DoInspectionSectionProps) => {
  const [dialogItem, setDialogItem] = useState<InspectionReportStructureRow | null>(null);
  const [draftValue, setDraftValue] = useState<string | number | ''>('');
  const [draftNote, setDraftNote] = useState('');
  const [draftUploadUrl, setDraftUploadUrl] = useState('');

  const typeOptions = useMemo(() => getTypeOptions(dialogItem?.type || ''), [dialogItem?.type]);

  const openInspectionDialog = (item: InspectionReportStructureRow) => {
    const existing = inspectionResponses[item.under_section_id];
    const options = getTypeOptions(item.type);

    if (existing) {
      setDraftValue(existing.value === null ? '' : existing.value);
      setDraftNote(existing.note || '');
      setDraftUploadUrl(existing.upload_url || '');
    } else if (options.length > 0) {
      setDraftValue(options.includes('NA') ? 'NA' : options[0]);
      setDraftNote('');
      setDraftUploadUrl('');
    } else {
      setDraftValue('');
      setDraftNote('');
      setDraftUploadUrl('');
    }

    setDialogItem(item);
  };

  const closeInspectionDialog = () => {
    setDialogItem(null);
    setDraftValue('');
    setDraftNote('');
    setDraftUploadUrl('');
  };

  const handleSaveInspectionDialog = () => {
    if (!dialogItem) return;

    const typeKey = (dialogItem.type || '').trim().toLowerCase();
    let normalizedValue: InspectionItemValue = draftValue === '' ? null : draftValue;

    if (typeKey === 'number') {
      normalizedValue = draftValue === '' ? null : Number(draftValue);
    } else if (typeKey === 'text field') {
      normalizedValue = String(draftValue ?? '').trim();
    } else {
      normalizedValue = draftValue === '' ? null : String(draftValue);
    }

    onSaveInspectionItem({
      under_section_id: dialogItem.under_section_id,
      header_section_id: dialogItem.header_section_id,
      type: dialogItem.type,
      value: normalizedValue,
      note: draftNote,
      upload_url: draftUploadUrl.trim()
    });

    closeInspectionDialog();
  };

  return (
    <>
      <p className="text-base font-extrabold text-[#243447] mb-2.5 mt-6">2. Do Inspection</p>

      <TableContainer className="border border-[#e5e7eb] rounded-md">
        <Table className="table-fixed">
          <TableHead>
            <TableRow>
              <TableCell head className="w-[54%] py-[6px]">Inspection Item</TableCell>
              <TableCell head className="w-[16%] py-[6px]">Action</TableCell>
              <TableCell head align="center" className="w-[14%] py-[6px]">Result</TableCell>
              <TableCell head align="center" className="w-[8%] py-[6px]">Note</TableCell>
              <TableCell head align="center" className="w-[8%] py-[6px]">Image</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groupedInspectionStructure.map((section) => {
              const expanded = expandedSectionIds.includes(section.header_section_id);

              return (
                <Fragment key={`section-fragment-${section.header_section_id}`}>
                  <TableRow
                    hover
                    className={expanded ? 'bg-[#d7ebfb]' : ''}
                    onClick={() => onToggleSection(section.header_section_id)}
                  >
                    <TableCell className="py-[5.5px]">
                      <div className="flex items-center gap-2">
                        {expanded ? <FaChevronDown size={13} /> : <FaChevronRight size={13} />}
                        <p className="font-medium text-[#243447]">{section.header_section_title}</p>
                      </div>
                    </TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell align="center">
                      <Button size="small" className={squareIconButtonClass}>
                        <FaRegCalendarAlt size={14} />
                      </Button>
                    </TableCell>
                    <TableCell align="center">
                      <Button size="small" className={squareIconButtonClass}>
                        <FaRegImage size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>

                  {expanded &&
                    section.items.map((item) => (
                      <TableRow key={`item-${item.header_section_id}-${item.under_section_id}`} hover>
                        <TableCell className="py-[4.5px] pl-12">
                          <p className="font-medium uppercase leading-tight text-[#243447]">{item.under_section_title}</p>
                        </TableCell>
                        <TableCell className="py-[4.5px]">
                          <Button
                            size="small"
                            startIcon={<FaSearch size={12} />}
                            onClick={() => openInspectionDialog(item)}
                            className="rounded-lg font-semibold normal-case bg-[#0a6ed1] text-white"
                          >
                            Inspection
                          </Button>
                        </TableCell>
                        <TableCell align="center" className="py-[4.5px]">
                          <p className="text-[0.78rem] text-[#1f2937] font-semibold">
                            {inspectionResponses[item.under_section_id]?.value ?? ''}
                          </p>
                        </TableCell>
                        <TableCell align="center" className="py-[4.5px]">
                          <Button size="small" className={squareIconButtonClass}>
                            <FaRegCalendarAlt size={14} />
                          </Button>
                        </TableCell>
                        <TableCell align="center" className="py-[4.5px]">
                          <Button
                            size="small"
                            className={`min-w-[34px] px-[7px] py-[4.5px] rounded-lg text-[#1f2937] ${
                              inspectionResponses[item.under_section_id]?.upload_url ? 'bg-[#d7e5b9]' : 'bg-[#e5e7eb]'
                            }`}
                          >
                            <FaRegImage size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <div className="mt-4 flex justify-start">
        <Button
          onClick={onNext}
          className="min-w-[76px] rounded-lg text-white bg-gradient-to-b from-[#1172d7] to-[#0a6ed1] shadow-[0_6px_14px_rgba(10,110,209,0.25)]"
        >
          Inspection Completed
        </Button>
      </div>

      <Dialog
        open={Boolean(dialogItem)}
        onClose={closeInspectionDialog}
        fullWidth
        maxWidth="sm"
        paperClassName="w-[620px] max-w-[94vw] h-auto max-h-[86vh]"
      >
        <DialogTitle className="pb-1">Inspection Item</DialogTitle>
        <DialogContent className="pt-0 overflow-y-auto max-h-[calc(86vh-120px)]">
          <p className="text-[1.1rem] font-bold mt-[6px] mb-[10px] uppercase text-[#1f2937]">
            {dialogItem?.under_section_title || ''}
          </p>

          <div className="border-t border-[#d1d5db] pt-4">
            <p className="text-[#5b7088] mb-[9.6px] text-[1.02rem]">
              <span className="text-[#ef4444]">*</span>Condition:
            </p>

            {typeOptions.length > 0 && (
              <div className="flex flex-wrap gap-[9.6px] mb-4">
                {typeOptions.map((option) => {
                  const checked = draftValue === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDraftValue(option)}
                      className={`inline-flex items-center gap-2 normal-case rounded-lg min-h-[36px] px-3.5 border text-[#1f2937] ${
                        checked ? 'border-[#1976d2] bg-[#eef6ff]' : 'border-[#cbd5e1] bg-white'
                      }`}
                    >
                      <Checkbox checked={checked} />
                      {option}
                    </button>
                  );
                })}
              </div>
            )}

            {(dialogItem?.type || '').toLowerCase() === 'text field' && (
              <TextField
                fullWidth
                size="small"
                label="Response"
                value={draftValue}
                onChange={(event) => setDraftValue(event.target.value)}
                className="mb-4"
              />
            )}

            {(dialogItem?.type || '').toLowerCase() === 'number' && (
              <TextField
                fullWidth
                size="small"
                label="Response"
                type="number"
                value={draftValue}
                onChange={(event) => setDraftValue(event.target.value)}
                className="mb-4"
              />
            )}

            <p className="text-[#5b7088] mb-2 text-[1.02rem]">Inspection Note:</p>
            <TextField
              fullWidth
              multiline
              minRows={3}
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
            />

            <p className="text-[#5b7088] mt-[17.6px] mb-2 text-[1.02rem]">Upload Image:</p>
            <TextField
              fullWidth
              size="small"
              placeholder="Paste uploaded file URL"
              value={draftUploadUrl}
              onChange={(event) => setDraftUploadUrl(event.target.value)}
              className="mb-[9.6px]"
            />
            <Button
              fullWidth
              startIcon={<FaRegImage size={14} />}
              className="mt-1 bg-[#d7e5b9] text-[#236d39] normal-case"
            >
              Upload (Optional)
            </Button>
          </div>
        </DialogContent>
        <DialogActions>
          <Button className="bg-transparent text-[#243447] hover:bg-black/5" onClick={closeInspectionDialog}>
            Cancel
          </Button>
          <Button className="bg-[#0a6ed1] text-white" onClick={handleSaveInspectionDialog}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DoInspectionSection;
