                    <div className="grid gap-2">
                        <Label htmlFor="amount">المبلغ</Label>
                        <Input
                            id="amount"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.000"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="notes">ملاحظات</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="أضف أي ملاحظات إضافية هنا..."
                        />
                    </div>
                </div >
    <DialogFooter className="gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            إلغاء
        </Button>
        <Button onClick={handleAdjustment} disabled={loading} className={type === "refund" ? "bg-blue-600 hover:bg-blue-700" : "bg-orange-600 hover:bg-orange-700"}>
            {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            {type === "refund" ? "تأكيد الإرجاع" : "خصم الأتعاب"}
        </Button>
    </DialogFooter>
            </DialogContent >
        </Dialog >
    );
};

export default BalanceAdjustmentDialog;
